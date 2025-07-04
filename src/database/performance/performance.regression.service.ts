import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PerformanceRegressionService {
  private readonly baselineMetrics: Map<string, any> = new Map();
  private readonly performanceThresholds: Map<string, number> = new Map();

  constructor(
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {
    this.initializeThresholds();
  }

  private initializeThresholds(): void {
    // Define performance thresholds for different metrics
    this.performanceThresholds.set('query_execution_time', 1000); // 1 second
    this.performanceThresholds.set('index_usage', 0.8); // 80% index usage
    this.performanceThresholds.set('cache_hit_ratio', 0.9); // 90% cache hit ratio
    this.performanceThresholds.set('table_scans', 0.1); // 10% table scans
  }

  async runPerformanceTests(): Promise<{
    success: boolean;
    regressions: PerformanceRegression[];
    metrics: PerformanceMetrics;
  }> {
    const regressions: PerformanceRegression[] = [];
    const metrics: PerformanceMetrics = {};

    try {
      // 1. Run baseline tests if not exists
      if (this.baselineMetrics.size === 0) {
        await this.establishBaseline();
      }

      // 2. Execute test queries
      const queryMetrics = await this.executeTestQueries();
      metrics.queryMetrics = queryMetrics;

      // 3. Analyze index usage
      const indexMetrics = await this.analyzeIndexUsage();
      metrics.indexMetrics = indexMetrics;

      // 4. Check cache performance
      const cacheMetrics = await this.checkCachePerformance();
      metrics.cacheMetrics = cacheMetrics;

      // 5. Monitor resource usage
      const resourceMetrics = await this.monitorResourceUsage();
      metrics.resourceMetrics = resourceMetrics;

      // 6. Compare with baseline
      regressions.push(...this.compareWithBaseline(metrics));

      // 7. Emit results
      this.emitResults(metrics, regressions);

      return {
        success: regressions.length === 0,
        regressions,
        metrics,
      };
    } catch (error) {
      this.eventEmitter.emit('performance.test.failure', {
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  private async establishBaseline(): Promise<void> {
    const metrics = await this.runPerformanceTests();
    this.baselineMetrics.set('queryMetrics', metrics.metrics.queryMetrics);
    this.baselineMetrics.set('indexMetrics', metrics.metrics.indexMetrics);
    this.baselineMetrics.set('cacheMetrics', metrics.metrics.cacheMetrics);
    this.baselineMetrics.set(
      'resourceMetrics',
      metrics.metrics.resourceMetrics,
    );

    // Save baseline to file
    await this.saveBaselineToFile();
  }

  private async executeTestQueries(): Promise<QueryMetrics> {
    const queryRunner = this.dataSource.createQueryRunner();
    const metrics: QueryMetrics = {};

    try {
      // Get critical queries from configuration
      const criticalQueries = await this.getCriticalQueries();

      for (const query of criticalQueries) {
        const startTime = Date.now();
        const result = await queryRunner.query(query.sql);
        const executionTime = Date.now() - startTime;

        metrics[query.name] = {
          executionTime,
          rowCount: result.length,
          timestamp: new Date(),
        };
      }
    } finally {
      await queryRunner.release();
    }

    return metrics;
  }

  private async analyzeIndexUsage(): Promise<IndexMetrics> {
    const queryRunner = this.dataSource.createQueryRunner();
    const metrics: IndexMetrics = {};

    try {
      // Get index usage statistics
      const indexStats = await queryRunner.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
      `);

      for (const stat of indexStats) {
        metrics[`${stat.schemaname}.${stat.tablename}.${stat.indexname}`] = {
          scans: stat.idx_scan,
          tuplesRead: stat.idx_tup_read,
          tuplesFetched: stat.idx_tup_fetch,
          timestamp: new Date(),
        };
      }
    } finally {
      await queryRunner.release();
    }

    return metrics;
  }
  private async checkCachePerformance(): Promise<CacheMetrics> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const cacheStats = await queryRunner.query(`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(idx_blks_read) as idx_read,
        sum(idx_blks_hit) as idx_hit
      FROM pg_statio_user_tables
    `);

      const stats = cacheStats[0];

      const metrics: CacheMetrics = {
        cacheHitRatio: {
          heapHitRatio: stats.heap_hit / (stats.heap_read + stats.heap_hit),
          indexHitRatio: stats.idx_hit / (stats.idx_read + stats.idx_hit),
          timestamp: new Date(),
        },
      };

      return metrics;
    } finally {
      await queryRunner.release();
    }
  }

  private async monitorResourceUsage(): Promise<ResourceMetrics> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      // Get database size
      const dbSize = await queryRunner.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);

      // Get table sizes
      const tableSizes = await queryRunner.query(`
      SELECT
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

      // Get connection count
      const connections = await queryRunner.query(`
      SELECT count(*) as connection_count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

      // Construct metrics object properly
      const metrics: ResourceMetrics = {
        databaseSize: dbSize[0].size,
        tableSizes,
        connectionCount: parseInt(connections[0].connection_count, 10),
      };

      return metrics;
    } finally {
      await queryRunner.release();
    }
  }

  private compareWithBaseline(
    metrics: PerformanceMetrics,
  ): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];

    // Compare query execution times
    if (metrics.queryMetrics) {
      for (const [queryName, metric] of Object.entries(metrics.queryMetrics)) {
        const baseline = this.baselineMetrics.get('queryMetrics')?.[queryName];
        const threshold = this.performanceThresholds.get(
          'query_execution_time',
        );

        if (
          baseline &&
          threshold !== undefined &&
          metric.executionTime > baseline.executionTime * 1.5
        ) {
          regressions.push({
            type: 'query_performance',
            metric: queryName,
            current: metric.executionTime,
            baseline: baseline.executionTime,
            threshold,
            severity: 'high',
          });
        }
      }
    }

    // Compare index usage
    const indexMetrics = metrics.indexMetrics;
    const baselineIndexMetrics = this.baselineMetrics.get('indexMetrics');
    const indexThreshold = this.performanceThresholds.get('index_usage');

    if (indexMetrics && baselineIndexMetrics && indexThreshold !== undefined) {
      for (const [indexName, metric] of Object.entries(indexMetrics)) {
        const baseline = baselineIndexMetrics[indexName];
        if (baseline && metric.scans < baseline.scans * indexThreshold) {
          regressions.push({
            type: 'index_usage',
            metric: indexName,
            current: metric.scans,
            baseline: baseline.scans,
            threshold: indexThreshold,
            severity: 'medium',
          });
        }
      }
    }

    return regressions;
  }

  private emitResults(
    metrics: PerformanceMetrics,
    regressions: PerformanceRegression[],
  ): void {
    this.eventEmitter.emit('performance.test.complete', {
      metrics,
      regressions,
      timestamp: new Date(),
    });

    if (regressions.length > 0) {
      this.eventEmitter.emit('performance.regression.detected', {
        regressions,
        timestamp: new Date(),
      });
    }
  }

  private async getCriticalQueries(): Promise<
    Array<{ name: string; sql: string }>
  > {
    // Implementation for getting critical queries
    return [];
  }

  private async saveBaselineToFile(): Promise<void> {
    const baselinePath = path.join(process.cwd(), 'baseline-metrics.json');
    await fs.promises.writeFile(
      baselinePath,
      JSON.stringify(Object.fromEntries(this.baselineMetrics), null, 2),
    );
  }
}

interface PerformanceMetrics {
  queryMetrics?: QueryMetrics;
  indexMetrics?: IndexMetrics;
  cacheMetrics?: CacheMetrics;
  resourceMetrics?: ResourceMetrics;
}

interface QueryMetrics {
  [key: string]: {
    executionTime: number;
    rowCount: number;
    timestamp: Date;
  };
}

interface IndexMetrics {
  [key: string]: {
    scans: number;
    tuplesRead: number;
    tuplesFetched: number;
    timestamp: Date;
  };
}

interface CacheMetrics {
  cacheHitRatio: {
    heapHitRatio: number;
    indexHitRatio: number;
    timestamp: Date;
  };
}

interface ResourceMetrics {
  databaseSize: string;
  tableSizes: Array<{ table_name: string; total_size: string }>;
  connectionCount: number;
}

interface PerformanceRegression {
  type: string;
  metric: string;
  current: number;
  baseline: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
}
