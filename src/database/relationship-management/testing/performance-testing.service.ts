import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { 
  PerformanceMetrics, 
  SmartLoadingConfig, 
  LoadingStrategy 
} from '../interfaces/relationship-management.interface';
import { RelationshipLoaderService } from '../services/relationship-loader.service';
import { RelationshipCacheService } from '../services/relationship-cache.service';
import { RelationshipMetadataService } from '../services/relationship-metadata.service';

export interface PerformanceTestConfig {
  entityName: string;
  sampleSize: number;
  iterations: number;
  loadingStrategies: LoadingStrategy[];
  maxDepth: number;
  enableCaching: boolean;
  warmupRuns: number;
}

export interface PerformanceTestResult {
  strategy: LoadingStrategy;
  metrics: PerformanceMetrics;
  averageExecutionTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  queryAnalysis: {
    totalQueries: number;
    duplicateQueries: number;
    slowQueries: number;
    nPlusOneIssues: number;
  };
  recommendations: string[];
}

export interface PerformanceReport {
  testConfig: PerformanceTestConfig;
  results: PerformanceTestResult[];
  bestStrategy: LoadingStrategy;
  summary: {
    totalTestTime: number;
    entitiesTested: number;
    issuesFound: number;
  };
  recommendations: string[];
}

@Injectable()
export class PerformanceTestingService {
  private readonly logger = new Logger(PerformanceTestingService.name);
  private queryLog: Array<{ query: string; duration: number; timestamp: number }> = [];

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private relationshipLoader: RelationshipLoaderService,
    private cacheService: RelationshipCacheService,
    private metadataService: RelationshipMetadataService,
  ) {
    this.setupQueryLogging();
  }

  async runPerformanceTest(config: PerformanceTestConfig): Promise<PerformanceReport> {
    this.logger.log(`Starting performance test for ${config.entityName}`);
    const startTime = Date.now();

    // Get sample entities for testing
    const sampleEntities = await this.getSampleEntities(config.entityName, config.sampleSize);
    
    if (sampleEntities.length === 0) {
      throw new Error(`No sample entities found for ${config.entityName}`);
    }

    const results: PerformanceTestResult[] = [];

    // Test each loading strategy
    for (const strategy of config.loadingStrategies) {
      this.logger.log(`Testing strategy: ${strategy}`);
      
      // Warmup runs
      if (config.warmupRuns > 0) {
        await this.runWarmup(sampleEntities, strategy, config);
      }

      const result = await this.testLoadingStrategy(
        sampleEntities,
        strategy,
        config
      );
      
      results.push(result);
    }

    const totalTestTime = Date.now() - startTime;
    const bestStrategy = this.determineBestStrategy(results);

    const report: PerformanceReport = {
      testConfig: config,
      results,
      bestStrategy,
      summary: {
        totalTestTime,
        entitiesTested: sampleEntities.length,
        issuesFound: this.countIssues(results),
      },
      recommendations: this.generateRecommendations(results, config),
    };

    this.logger.log(`Performance test completed in ${totalTestTime}ms`);
    return report;
  }

  private async getSampleEntities(entityName: string, sampleSize: number): Promise<any[]> {
    const repository = this.dataSource.getRepository(entityName);
    
    return await repository
      .createQueryBuilder('entity')
      .take(sampleSize)
      .getMany();
  }

  private async runWarmup(
    entities: any[],
    strategy: LoadingStrategy,
    config: PerformanceTestConfig
  ): Promise<void> {
    this.logger.debug(`Running ${config.warmupRuns} warmup iterations for ${strategy}`);
    
    const warmupConfig: SmartLoadingConfig = {
      strategy,
      batchSize: 10,
      maxDepth: config.maxDepth,
      cacheConfig: config.enableCaching ? {
        ttl: 300,
        maxSize: 100,
        keyPrefix: 'warmup',
        compression: false,
        evictionPolicy: 'LRU',
      } : undefined,
    };

    for (let i = 0; i < config.warmupRuns; i++) {
      const sampleEntity = entities[i % entities.length];
      await this.relationshipLoader.loadRelationships(sampleEntity, warmupConfig);
    }
  }

  private async testLoadingStrategy(
    entities: any[],
    strategy: LoadingStrategy,
    config: PerformanceTestConfig
  ): Promise<PerformanceTestResult> {
    const metrics: PerformanceMetrics = {
      queryCount: 0,
      executionTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      entityCount: entities.length,
      relationshipDepth: config.maxDepth,
    };

    const executionTimes: number[] = [];
    const memorySnapshots: any[] = [];

    // Clear query log
    this.queryLog = [];

    // Clear cache if testing without cache
    if (!config.enableCaching) {
      await this.cacheService.clear();
    }

    const loadingConfig: SmartLoadingConfig = {
      strategy,
      batchSize: this.calculateOptimalBatchSize(strategy, entities.length),
      maxDepth: config.maxDepth,
      cacheConfig: config.enableCaching ? {
        ttl: 300,
        maxSize: 1000,
        keyPrefix: `test:${strategy}`,
        compression: true,
        evictionPolicy: 'LRU',
      } : undefined,
    };

    // Run test iterations
    for (let iteration = 0; iteration < config.iterations; iteration++) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Test each entity
      for (const entity of entities) {
        await this.relationshipLoader.loadRelationships(entity, loadingConfig);
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      executionTimes.push(endTime - startTime);
      memorySnapshots.push({
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      });
    }

    // Calculate metrics
    metrics.executionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    metrics.queryCount = this.queryLog.length;
    
    if (config.enableCaching) {
      const cacheMetrics = await this.cacheService.getMetrics();
      metrics.cacheHitRate = cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses);
    }

    const avgMemory = memorySnapshots.reduce((sum, snapshot) => ({
      heapUsed: sum.heapUsed + snapshot.heapUsed,
      heapTotal: sum.heapTotal + snapshot.heapTotal,
      external: sum.external + snapshot.external,
    }), { heapUsed: 0, heapTotal: 0, external: 0 });

    avgMemory.heapUsed /= memorySnapshots.length;
    avgMemory.heapTotal /= memorySnapshots.length;
    avgMemory.external /= memorySnapshots.length;

    const queryAnalysis = this.analyzeQueries();

    return {
      strategy,
      metrics,
      averageExecutionTime: metrics.executionTime,
      memoryUsage: avgMemory,
      queryAnalysis,
      recommendations: this.generateStrategyRecommendations(strategy, metrics, queryAnalysis),
    };
  }

  private calculateOptimalBatchSize(strategy: LoadingStrategy, entityCount: number): number {
    switch (strategy) {
      case LoadingStrategy.BATCH:
        return Math.min(50, Math.ceil(entityCount / 10));
      case LoadingStrategy.EAGER:
        return Math.min(20, entityCount);
      case LoadingStrategy.SMART:
        return Math.min(30, Math.ceil(entityCount / 5));
      default:
        return 25;
    }
  }

  private analyzeQueries(): {
    totalQueries: number;
    duplicateQueries: number;
    slowQueries: number;
    nPlusOneIssues: number;
  } {
    const queryStrings = this.queryLog.map(log => log.query);
    const uniqueQueries = new Set(queryStrings);
    const duplicateQueries = queryStrings.length - uniqueQueries.size;
    
    const slowQueries = this.queryLog.filter(log => log.duration > 100).length;
    
    // Simple N+1 detection: look for repeated similar queries
    const nPlusOneIssues = this.detectNPlusOneIssues();

    return {
      totalQueries: this.queryLog.length,
      duplicateQueries,
      slowQueries,
      nPlusOneIssues,
    };
  }

  private detectNPlusOneIssues(): number {
    const queryPatterns = new Map<string, number>();
    
    this.queryLog.forEach(log => {
      // Normalize query by removing specific IDs
      const normalizedQuery = log.query.replace(/['"][^'"]*['"]/g, '?');
      const count = queryPatterns.get(normalizedQuery) || 0;
      queryPatterns.set(normalizedQuery, count + 1);
    });

    // Count patterns that appear more than 5 times (potential N+1)
    return Array.from(queryPatterns.values()).filter(count => count > 5).length;
  }

  private determineBestStrategy(results: PerformanceTestResult[]): LoadingStrategy {
    // Score each strategy based on multiple factors
    const scores = results.map(result => {
      let score = 0;
      
      // Execution time (lower is better)
      const maxTime = Math.max(...results.map(r => r.averageExecutionTime));
      score += (1 - result.averageExecutionTime / maxTime) * 40;
      
      // Memory usage (lower is better)
      const maxMemory = Math.max(...results.map(r => r.memoryUsage.heapUsed));
      score += (1 - result.memoryUsage.heapUsed / maxMemory) * 30;
      
      // Query count (lower is better)
      const maxQueries = Math.max(...results.map(r => r.queryAnalysis.totalQueries));
      score += (1 - result.queryAnalysis.totalQueries / maxQueries) * 20;
      
      // Cache hit rate (higher is better)
      score += result.metrics.cacheHitRate * 10;

      return { strategy: result.strategy, score };
    });

    return scores.reduce((best, current) => 
      current.score > best.score ? current : best
    ).strategy;
  }

  private countIssues(results: PerformanceTestResult[]): number {
    return results.reduce((total, result) => 
      total + result.queryAnalysis.slowQueries + result.queryAnalysis.nPlusOneIssues, 0
    );
  }

  private generateRecommendations(
    results: PerformanceTestResult[], 
    config: PerformanceTestConfig
  ): string[] {
    const recommendations: string[] = [];
    
    const bestResult = results.find(r => r.strategy === this.determineBestStrategy(results));
    if (bestResult) {
      recommendations.push(`Use ${bestResult.strategy} loading strategy for optimal performance`);
    }

    // Check for N+1 issues
    const nPlusOneIssues = results.reduce((sum, r) => sum + r.queryAnalysis.nPlusOneIssues, 0);
    if (nPlusOneIssues > 0) {
      recommendations.push('Consider using batch loading or eager loading to resolve N+1 query issues');
    }

    // Check memory usage
    const highMemoryUsage = results.some(r => r.memoryUsage.heapUsed > 50 * 1024 * 1024); // 50MB
    if (highMemoryUsage) {
      recommendations.push('Consider implementing pagination or reducing relationship depth to manage memory usage');
    }

    // Check cache effectiveness
    if (config.enableCaching) {
      const lowCacheHitRate = results.some(r => r.metrics.cacheHitRate < 0.5);
      if (lowCacheHitRate) {
        recommendations.push('Review cache configuration - low hit rate detected');
      }
    }

    return recommendations;
  }

  private generateStrategyRecommendations(
    strategy: LoadingStrategy,
    metrics: PerformanceMetrics,
    queryAnalysis: any
  ): string[] {
    const recommendations: string[] = [];

    switch (strategy) {
      case LoadingStrategy.EAGER:
        if (queryAnalysis.totalQueries > metrics.entityCount * 2) {
          recommendations.push('Consider reducing relationship depth for eager loading');
        }
        break;
      
      case LoadingStrategy.LAZY:
        if (queryAnalysis.nPlusOneIssues > 0) {
          recommendations.push('N+1 issues detected with lazy loading - consider batch loading');
        }
        break;
      
      case LoadingStrategy.BATCH:
        if (metrics.executionTime > 1000) {
          recommendations.push('Consider reducing batch size or using smart loading');
        }
        break;
      
      case LoadingStrategy.SMART:
        if (metrics.cacheHitRate < 0.3) {
          recommendations.push('Improve cache configuration for smart loading');
        }
        break;
    }

    return recommendations;
  }

  private setupQueryLogging(): void {
    // This would integrate with TypeORM's logging system
    // For now, we'll use a simple approach
  }

  // Utility method to run comparative tests
  async runComparativeTest(
    entityNames: string[],
    baseConfig: Omit<PerformanceTestConfig, 'entityName'>
  ): Promise<Map<string, PerformanceReport>> {
    const results = new Map<string, PerformanceReport>();

    for (const entityName of entityNames) {
      const config: PerformanceTestConfig = {
        ...baseConfig,
        entityName,
      };

      try {
        const report = await this.runPerformanceTest(config);
        results.set(entityName, report);
      } catch (error) {
        this.logger.error(`Error testing ${entityName}:`, error);
      }
    }

    return results;
  }

  // Method to generate performance report
  generatePerformanceReport(report: PerformanceReport): string {
    const lines: string[] = [];
    
    lines.push(`Performance Test Report for ${report.testConfig.entityName}`);
    lines.push('='.repeat(50));
    lines.push(`Test Duration: ${report.summary.totalTestTime}ms`);
    lines.push(`Entities Tested: ${report.summary.entitiesTested}`);
    lines.push(`Issues Found: ${report.summary.issuesFound}`);
    lines.push(`Best Strategy: ${report.bestStrategy}`);
    lines.push('');

    report.results.forEach(result => {
      lines.push(`Strategy: ${result.strategy}`);
      lines.push(`  Avg Execution Time: ${result.averageExecutionTime}ms`);
      lines.push(`  Total Queries: ${result.queryAnalysis.totalQueries}`);
      lines.push(`  Memory Usage: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      lines.push(`  Cache Hit Rate: ${(result.metrics.cacheHitRate * 100).toFixed(1)}%`);
      lines.push('');
    });

    lines.push('Recommendations:');
    report.recommendations.forEach(rec => lines.push(`- ${rec}`));

    return lines.join('\n');
  }
} 