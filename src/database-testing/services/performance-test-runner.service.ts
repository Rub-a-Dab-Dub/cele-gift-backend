import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { PerformanceBaseline } from '../entities/performance-baseline.entity';
import * as os from 'os';

export interface PerformanceTestOptions {
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  collectQueryStats?: boolean;
  collectMemoryStats?: boolean;
  collectCpuStats?: boolean;
  baseline?: string;
}

export interface PerformanceResult {
  testName: string;
  iterations: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  memory: {
    initialUsage: number;
    peakUsage: number;
    finalUsage: number;
    delta: number;
  };
  cpu: {
    userTime: number;
    systemTime: number;
    totalTime: number;
  };
  queries: {
    count: number;
    totalTime: number;
    slowestQuery: number;
    averageQueryTime: number;
  };
  throughput: {
    operationsPerSecond: number;
    queriesPerSecond: number;
  };
  baseline?: {
    name: string;
    comparison: 'better' | 'worse' | 'similar';
    percentageDiff: number;
  };
}

export interface QueryStatistics {
  query: string;
  duration: number;
  rowsAffected: number;
  planningTime?: number;
  executionTime?: number;
}

@Injectable()
export class PerformanceTestRunner {
  private readonly logger = new Logger(PerformanceTestRunner.name);
  private queryStats: QueryStatistics[] = [];

  constructor(
    @InjectRepository(PerformanceBaseline)
    private baselineRepository: Repository<PerformanceBaseline>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async runPerformanceTest<T>(
    testName: string,
    testFunction: () => Promise<T>,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceResult> {
    const {
      iterations = 10,
      warmupIterations = 2,
      timeout = 30000,
      collectQueryStats = true,
      collectMemoryStats = true,
      collectCpuStats = true,
      baseline,
    } = options;

    this.logger.log(`Starting performance test: ${testName}`);

    // Clear previous query stats
    this.queryStats = [];

    // Setup monitoring
    const queryRunner = collectQueryStats ? this.dataSource.createQueryRunner() : null;
    if (queryRunner) {
      await queryRunner.connect();
      await this.setupQueryMonitoring(queryRunner);
    }

    try {
      // Warmup iterations
      for (let i = 0; i < warmupIterations; i++) {
        await this.executeWithTimeout(testFunction, timeout);
      }

      // Clear stats after warmup
      this.queryStats = [];
      const initialMemory = collectMemoryStats ? this.getMemoryUsage() : null;
      const initialCpu = collectCpuStats ? process.cpuUsage() : null;

      // Main test iterations
      const durations: number[] = [];
      let peakMemory = initialMemory?.used || 0;
      let queryCount = 0;
      let totalQueryTime = 0;

      for (let i = 0; i < iterations; i++) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const startTime = process.hrtime.bigint();
        const startQueryCount = this.queryStats.length;

        await this.executeWithTimeout(testFunction, timeout);

        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

        durations.push(duration);

        // Track memory usage
        if (collectMemoryStats) {
          const currentMemory = this.getMemoryUsage();
          peakMemory = Math.max(peakMemory, currentMemory.used);
        }

        // Track query stats
        const iterationQueryCount = this.queryStats.length - startQueryCount;
        queryCount += iterationQueryCount;
        
        const iterationQueries = this.queryStats.slice(startQueryCount);
        totalQueryTime += iterationQueries.reduce((sum, stat) => sum + stat.duration, 0);
      }

      const finalMemory = collectMemoryStats ? this.getMemoryUsage() : null;
      const finalCpu = collectCpuStats ? process.cpuUsage(initialCpu) : null;

      // Calculate statistics
      const result = this.calculatePerformanceResult(
        testName,
        durations,
        {
          initialMemory,
          peakMemory,
          finalMemory,
          finalCpu,
          queryCount,
          totalQueryTime,
        }
      );

      // Compare with baseline if provided
      if (baseline) {
        result.baseline = await this.compareWithBaseline(baseline, result);
      }

      this.logger.log(`Performance test completed: ${testName} - Avg: ${result.averageDuration.toFixed(2)}ms`);

      return result;

    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  }

  private async executeWithTimeout<T>(
    testFunction: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      testFunction()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  private calculatePerformanceResult(
    testName: string,
    durations: number[],
    metadata: any
  ): PerformanceResult {
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      testName,
      iterations: durations.length,
      totalDuration,
      averageDuration: totalDuration / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      percentiles: {
        p50: this.getPercentile(sortedDurations, 0.5),
        p90: this.getPercentile(sortedDurations, 0.9),
        p95: this.getPercentile(sortedDurations, 0.95),
        p99: this.getPercentile(sortedDurations, 0.99),
      },
      memory: {
        initialUsage: metadata.initialMemory?.used || 0,
        peakUsage: metadata.peakMemory || 0,
        finalUsage: metadata.finalMemory?.used || 0,
        delta: (metadata.finalMemory?.used || 0) - (metadata.initialMemory?.used || 0),
      },
      cpu: {
        userTime: metadata.finalCpu?.user || 0,
        systemTime: metadata.finalCpu?.system || 0,
        totalTime: (metadata.finalCpu?.user || 0) + (metadata.finalCpu?.system || 0),
      },
      queries: {
        count: metadata.queryCount || 0,
        totalTime: metadata.totalQueryTime || 0,
        slowestQuery: this.queryStats.length > 0 
          ? Math.max(...this.queryStats.map(q => q.duration))
          : 0,
        averageQueryTime: metadata.queryCount > 0 
          ? metadata.totalQueryTime / metadata.queryCount 
          : 0,
      },
      throughput: {
        operationsPerSecond: (durations.length / totalDuration) * 1000,
        queriesPerSecond: metadata.queryCount > 0 
          ? (metadata.queryCount / totalDuration) * 1000 
          : 0,
      },
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  private getMemoryUsage(): { used: number; total: number; available: number } {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      used: memUsage.heapUsed,
      total: totalMem,
      available: freeMem,
    };
  }

  private async setupQueryMonitoring(queryRunner: QueryRunner): Promise<void> {
    // Enable query logging for this connection
    try {
      await queryRunner.query('SET log_statement = "all"');
      await queryRunner.query('SET log_duration = on');
      await queryRunner.query('SET log_min_duration_statement = 0');
    } catch (error) {
      this.logger.warn('Could not enable query logging', error);
    }

    // Hook into query execution
    const originalQuery = queryRunner.query.bind(queryRunner);
    queryRunner.query = async (query: string, parameters?: any[]) => {
      const startTime = process.hrtime.bigint();
      
      try {
        const result = await originalQuery(query, parameters);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

        this.queryStats.push({
          query: query.substring(0, 100), // Truncate for readability
          duration,
          rowsAffected: Array.isArray(result) ? result.length : (result?.affectedRows || 0),
        });

        return result;
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;

        this.queryStats.push({
          query: query.substring(0, 100),
          duration,
          rowsAffected: 0,
        });

        throw error;
      }
    };
  }

  async createBaseline(
    name: string,
    version: string,
    testSuite: string,
    testName: string,
    result: PerformanceResult,
    thresholds?: {
      max?: number;
      avg?: number;
      p95?: number;
      memory?: number;
      queries?: number;
    }
  ): Promise<PerformanceBaseline> {
    const baseline = this.baselineRepository.create({
      name,
      version,
      description: `Performance baseline for ${testName}`,
      testSuite,
      testName,
      baselineMetrics: {
        duration: result.averageDuration,
        memory: result.memory,
        queries: result.queries,
        cpu: result.cpu,
      },
      thresholds: thresholds || {
        max: result.maxDuration * 1.2,
        avg: result.averageDuration * 1.1,
        p95: result.percentiles.p95 * 1.15,
        memory: result.memory.peakUsage * 1.2,
        queries: result.queries.count * 1.1,
      },
      sampleSize: result.iterations,
      confidenceLevel: 95,
      environment: process.env.NODE_ENV || 'test',
      databaseVersion: await this.getDatabaseVersion(),
      statisticalData: {
        mean: result.averageDuration,
        median: result.percentiles.p50,
        standardDeviation: this.calculateStandardDeviation([result.averageDuration]), // Simplified
        percentiles: result.percentiles,
      },
    });

    return await this.baselineRepository.save(baseline);
  }

  private async compareWithBaseline(
    baselineName: string,
    result: PerformanceResult
  ): Promise<PerformanceResult['baseline']> {
    const baseline = await this.baselineRepository.findOne({
      where: { name: baselineName, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!baseline) {
      this.logger.warn(`Baseline '${baselineName}' not found`);
      return undefined;
    }

    const baselineAvg = baseline.baselineMetrics.duration;
    const currentAvg = result.averageDuration;
    const percentageDiff = ((currentAvg - baselineAvg) / baselineAvg) * 100;

    let comparison: 'better' | 'worse' | 'similar' = 'similar';
    const threshold = 5; // 5% threshold for similarity

    if (percentageDiff < -threshold) {
      comparison = 'better';
    } else if (percentageDiff > threshold) {
      comparison = 'worse';
    }

    return {
      name: baselineName,
      comparison,
      percentageDiff,
    };
  }

  private async getDatabaseVersion(): Promise<string> {
    try {
      const result = await this.dataSource.query('SELECT version()');
      return result[0]?.version || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // Specialized performance test methods
  async runConcurrencyTest(
    testName: string,
    testFunction: () => Promise<any>,
    concurrency: number,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceResult & { concurrency: number; failures: number }> {
    const promises: Promise<any>[] = [];
    const startTime = process.hrtime.bigint();
    let failures = 0;

    // Launch concurrent operations
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        testFunction().catch(error => {
          failures++;
          this.logger.warn(`Concurrent operation ${i} failed:`, error.message);
        })
      );
    }

    await Promise.allSettled(promises);
    
    const endTime = process.hrtime.bigint();
    const totalDuration = Number(endTime - startTime) / 1_000_000;

    const result = this.calculatePerformanceResult(testName, [totalDuration], {
      queryCount: this.queryStats.length,
      totalQueryTime: this.queryStats.reduce((sum, stat) => sum + stat.duration, 0),
    });

    return {
      ...result,
      concurrency,
      failures,
    };
  }

  async runLoadTest(
    testName: string,
    testFunction: () => Promise<any>,
    duration: number, // milliseconds
    targetRps: number, // requests per second
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceResult & { requestsSent: number; successRate: number }> {
    const startTime = Date.now();
    const endTime = startTime + duration;
    const intervalMs = 1000 / targetRps;
    
    let requestsSent = 0;
    let successfulRequests = 0;
    const durations: number[] = [];

    while (Date.now() < endTime) {
      const requestStart = process.hrtime.bigint();
      
      try {
        await testFunction();
        const requestEnd = process.hrtime.bigint();
        const requestDuration = Number(requestEnd - requestStart) / 1_000_000;
        
        durations.push(requestDuration);
        successfulRequests++;
      } catch (error) {
        this.logger.warn(`Load test request failed:`, error.message);
      }
      
      requestsSent++;
      
      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    const result = this.calculatePerformanceResult(testName, durations, {
      queryCount: this.queryStats.length,
      totalQueryTime: this.queryStats.reduce((sum, stat) => sum + stat.duration, 0),
    });

    return {
      ...result,
      requestsSent,
      successRate: (successfulRequests / requestsSent) * 100,
    };
  }

  async runRampUpTest(
    testName: string,
    testFunction: () => Promise<any>,
    startRps: number,
    endRps: number,
    rampDuration: number, // milliseconds
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceResult & { rampProfile: { time: number; rps: number; responseTime: number }[] }> {
    const startTime = Date.now();
    const endTime = startTime + rampDuration;
    const rampProfile: { time: number; rps: number; responseTime: number }[] = [];
    const durations: number[] = [];
    
    let currentTime = startTime;
    
    while (currentTime < endTime) {
      const progress = (currentTime - startTime) / rampDuration;
      const currentRps = startRps + (endRps - startRps) * progress;
      const intervalMs = 1000 / currentRps;
      
      const requestStart = process.hrtime.bigint();
      
      try {
        await testFunction();
        const requestEnd = process.hrtime.bigint();
        const requestDuration = Number(requestEnd - requestStart) / 1_000_000;
        
        durations.push(requestDuration);
        rampProfile.push({
          time: currentTime - startTime,
          rps: currentRps,
          responseTime: requestDuration,
        });
      } catch (error) {
        this.logger.warn(`Ramp-up test request failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      currentTime = Date.now();
    }

    const result = this.calculatePerformanceResult(testName, durations, {
      queryCount: this.queryStats.length,
      totalQueryTime: this.queryStats.reduce((sum, stat) => sum + stat.duration, 0),
    });

    return {
      ...result,
      rampProfile,
    };
  }

  // Database-specific performance tests
  async runConnectionPoolTest(
    testName: string,
    maxConnections: number,
    operationsPerConnection: number,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceResult & { connectionMetrics: any }> {
    const connections: QueryRunner[] = [];
    const durations: number[] = [];
    let totalQueries = 0;

    try {
      // Create connections
      for (let i = 0; i < maxConnections; i++) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        connections.push(queryRunner);
      }

      const startTime = process.hrtime.bigint();

      // Execute operations on each connection
      const promises = connections.map(async (queryRunner, index) => {
        for (let op = 0; op < operationsPerConnection; op++) {
          const opStart = process.hrtime.bigint();
          
          try {
            await queryRunner.query('SELECT 1');
            totalQueries++;
          } catch (error) {
            this.logger.warn(`Connection ${index} operation ${op} failed:`, error.message);
          }
          
          const opEnd = process.hrtime.bigint();
          durations.push(Number(opEnd - opStart) / 1_000_000);
        }
      });

      await Promise.allSettled(promises);
      
      const endTime = process.hrtime.bigint();
      const totalDuration = Number(endTime - startTime) / 1_000_000;

      const result = this.calculatePerformanceResult(testName, durations, {
        queryCount: totalQueries,
        totalQueryTime: durations.reduce((sum, d) => sum + d, 0),
      });

      return {
        ...result,
        connectionMetrics: {
          maxConnections,
          operationsPerConnection,
          totalOperations: maxConnections * operationsPerConnection,
          successfulQueries: totalQueries,
        },
      };

    } finally {
      // Clean up connections
      for (const queryRunner of connections) {
        try {
          await queryRunner.release();
        } catch (error) {
          this.logger.warn('Failed to release connection:', error.message);
        }
      }
    }
  }

  async runTransactionTest(
    testName: string,
    transactionFunction: (queryRunner: QueryRunner) => Promise<void>,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceResult & { transactionMetrics: any }> {
    const durations: number[] = [];
    const iterations = options.iterations || 10;
    let successfulTransactions = 0;
    let rolledBackTransactions = 0;

    for (let i = 0; i < iterations; i++) {
      const queryRunner = this.dataSource.createQueryRunner();
      
      try {
        await queryRunner.connect();
        
        const startTime = process.hrtime.bigint();
        await queryRunner.startTransaction();
        
        try {
          await transactionFunction(queryRunner);
          await queryRunner.commitTransaction();
          successfulTransactions++;
        } catch (error) {
          await queryRunner.rollbackTransaction();
          rolledBackTransactions++;
          throw error;
        }
        
        const endTime = process.hrtime.bigint();
        durations.push(Number(endTime - startTime) / 1_000_000);
        
      } catch (error) {
        this.logger.warn(`Transaction ${i} failed:`, error.message);
      } finally {
        await queryRunner.release();
      }
    }

    const result = this.calculatePerformanceResult(testName, durations, {
      queryCount: this.queryStats.length,
      totalQueryTime: this.queryStats.reduce((sum, stat) => sum + stat.duration, 0),
    });

    return {
      ...result,
      transactionMetrics: {
        totalTransactions: iterations,
        successfulTransactions,
        rolledBackTransactions,
        successRate: (successfulTransactions / iterations) * 100,
      },
    };
  }

  // Query performance analysis
  async analyzeQueryPerformance(
    query: string,
    parameters?: any[],
    iterations: number = 100
  ): Promise<{
    result: PerformanceResult;
    executionPlan: any;
    statistics: any;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      
      // Get execution plan
      const planResult = await queryRunner.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`, parameters);
      const executionPlan = planResult[0]['QUERY PLAN'];
      
      // Get query statistics
      await queryRunner.query('SELECT pg_stat_reset()'); // Reset stats
      
      // Run performance test
      const result = await this.runPerformanceTest(
        `Query: ${query.substring(0, 50)}...`,
        async () => {
          await queryRunner.query(query, parameters);
        },
        { iterations, collectQueryStats: true }
      );
      
      // Get updated statistics
      const statsResult = await queryRunner.query(`
        SELECT 
          calls,
          total_time,
          mean_time,
          max_time,
          min_time,
          rows
        FROM pg_stat_statements 
        WHERE query ILIKE $1
        LIMIT 1
      `, [`%${query.substring(0, 30)}%`]);
      
      return {
        result,
        executionPlan,
        statistics: statsResult[0] || {},
      };
      
    } finally {
      await queryRunner.release();
    }
  }

  // Batch operation performance testing
  async runBatchPerformanceTest(
    testName: string,
    batchOperation: (batchSize: number) => Promise<void>,
    batchSizes: number[],
    options: PerformanceTestOptions = {}
  ): Promise<{ batchSize: number; result: PerformanceResult }[]> {
    const results: { batchSize: number; result: PerformanceResult }[] = [];
    
    for (const batchSize of batchSizes) {
      this.logger.log(`Testing batch size: ${batchSize}`);
      
      const result = await this.runPerformanceTest(
        `${testName} (batch size: ${batchSize})`,
        () => batchOperation(batchSize),
        options
      );
      
      results.push({ batchSize, result });
    }
    
    return results;
  }

  // Memory leak detection
  async detectMemoryLeaks(
    testName: string,
    testFunction: () => Promise<void>,
    iterations: number = 100,
    memoryThreshold: number = 50 * 1024 * 1024 // 50MB
  ): Promise<{
    hasMemoryLeak: boolean;
    memoryGrowth: number;
    memoryProfile: { iteration: number; memoryUsage: number }[];
  }> {
    const memoryProfile: { iteration: number; memoryUsage: number }[] = [];
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < iterations; i++) {
      await testFunction();
      
      // Force garbage collection every 10 iterations
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
      
      const currentMemory = process.memoryUsage().heapUsed;
      memoryProfile.push({
        iteration: i,
        memoryUsage: currentMemory,
      });
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    const hasMemoryLeak = memoryGrowth > memoryThreshold;
    
    if (hasMemoryLeak) {
      this.logger.warn(`Potential memory leak detected in ${testName}: ${memoryGrowth} bytes growth`);
    }
    
    return {
      hasMemoryLeak,
      memoryGrowth,
      memoryProfile,
    };
  }

  // Get performance insights
  async getPerformanceInsights(results: PerformanceResult[]): Promise<{
    trends: any[];
    recommendations: string[];
    alerts: string[];
  }> {
    const trends: any[] = [];
    const recommendations: string[] = [];
    const alerts: string[] = [];
    
    if (results.length < 2) {
      return { trends, recommendations, alerts };
    }
    
    // Analyze trends
    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      const previous = results[i - 1];
      
      const durationChange = ((current.averageDuration - previous.averageDuration) / previous.averageDuration) * 100;
      const memoryChange = ((current.memory.peakUsage - previous.memory.peakUsage) / previous.memory.peakUsage) * 100;
      
      trends.push({
        testName: current.testName,
        durationChange,
        memoryChange,
        trend: durationChange > 10 ? 'degrading' : durationChange < -10 ? 'improving' : 'stable',
      });
      
      // Generate alerts
      if (durationChange > 25) {
        alerts.push(`Performance degradation detected in ${current.testName}: ${durationChange.toFixed(1)}% slower`);
      }
      
      if (memoryChange > 50) {
        alerts.push(`Memory usage spike detected in ${current.testName}: ${memoryChange.toFixed(1)}% increase`);
      }
    }
    
    // Generate recommendations
    const avgDuration = results.reduce((sum, r) => sum + r.averageDuration, 0) / results.length;
    const avgMemory = results.reduce((sum, r) => sum + r.memory.peakUsage, 0) / results.length;
    
    if (avgDuration > 1000) {
      recommendations.push('Consider optimizing slow operations (average duration > 1s)');
    }
    
    if (avgMemory > 100 * 1024 * 1024) {
      recommendations.push('Consider memory optimization (average peak usage > 100MB)');
    }
    
    const highQueryCounts = results.filter(r => r.queries.count > 100);
    if (highQueryCounts.length > 0) {
      recommendations.push('Consider reducing database queries or implementing query optimization');
    }
    
    return { trends, recommendations, alerts };
  }

  // Cleanup methods
  clearQueryStats(): void {
    this.queryStats = [];
  }

  getQueryStats(): QueryStatistics[] {
    return [...this.queryStats];
  }

  async getActiveBaselines(): Promise<PerformanceBaseline[]> {
    return await this.baselineRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateBaseline(id: string, updates: Partial<PerformanceBaseline>): Promise<PerformanceBaseline> {
    await this.baselineRepository.update(id, updates);
    return await this.baselineRepository.findOne({ where: { id } });
  }

  async deactivateBaseline(id: string): Promise<void> {
    await this.baselineRepository.update(id, { isActive: false });
  }
}