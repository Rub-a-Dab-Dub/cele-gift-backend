import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseMetric } from '../entities/database-metric.entity';
import { AlertingService } from './alerting.service';

export interface HealthMetrics {
  connectionPool: {
    active: number;
    idle: number;
    total: number;
    utilization: number;
  };
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    queryThroughput: number;
  };
  storage: {
    totalSize: number;
    usedSize: number;
    freeSpace: number;
    utilizationPercentage: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskIo: {
      reads: number;
      writes: number;
    };
  };
  replication: {
    status: string;
    lag: number;
    syncStatus: boolean;
  };
  locks: {
    activelocks: number;
    blockedQueries: number;
    deadlocks: number;
  };
}

@Injectable()
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(DatabaseMetric)
    private metricRepository: Repository<DatabaseMetric>,
    private alertingService: AlertingService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectHealthMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherHealthMetrics();
      await this.persistMetrics(metrics);
      await this.evaluateHealthThresholds(metrics);
    } catch (error) {
      this.logger.error('Failed to collect health metrics', error);
    }
  }

  async gatherHealthMetrics(): Promise<HealthMetrics> {
    const [
      connectionMetrics,
      performanceMetrics,
      storageMetrics,
      systemMetrics,
      replicationMetrics,
      lockMetrics,
    ] = await Promise.all([
      this.getConnectionMetrics(),
      this.getPerformanceMetrics(),
      this.getStorageMetrics(),
      this.getSystemMetrics(),
      this.getReplicationMetrics(),
      this.getLockMetrics(),
    ]);

    return {
      connectionPool: connectionMetrics,
      performance: performanceMetrics,
      storage: storageMetrics,
      system: systemMetrics,
      replication: replicationMetrics,
      locks: lockMetrics,
    };
  }

  private async getConnectionMetrics(): Promise<HealthMetrics['connectionPool']> {
    // PostgreSQL specific queries
    const queries = [
      `SELECT count(*) as total_connections FROM pg_stat_activity;`,
      `SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';`,
      `SELECT count(*) as idle_connections FROM pg_stat_activity WHERE state = 'idle';`,
      `SHOW max_connections;`,
    ];

    try {
      const [totalResult, activeResult, idleResult, maxResult] = await Promise.all(
        queries.map(query => this.dataSource.query(query))
      );

      const total = parseInt(totalResult[0]?.total_connections || 0);
      const active = parseInt(activeResult[0]?.active_connections || 0);
      const idle = parseInt(idleResult[0]?.idle_connections || 0);
      const maxConnections = parseInt(maxResult[0]?.max_connections || 100);

      return {
        active,
        idle,
        total,
        utilization: (total / maxConnections) * 100,
      };
    } catch (error) {
      this.logger.error('Failed to get connection metrics', error);
      return { active: 0, idle: 0, total: 0, utilization: 0 };
    }
  }

  private async getPerformanceMetrics(): Promise<HealthMetrics['performance']> {
    try {
      const performanceQuery = `
        SELECT 
          AVG(mean_exec_time) as avg_query_time,
          COUNT(CASE WHEN mean_exec_time > 1000 THEN 1 END) as slow_queries,
          SUM(calls) as total_queries
        FROM pg_stat_statements 
        WHERE queryid IS NOT NULL;
      `;

      const result = await this.dataSource.query(performanceQuery);
      const row = result[0] || {};

      return {
        averageQueryTime: parseFloat(row.avg_query_time || 0),
        slowQueries: parseInt(row.slow_queries || 0),
        queryThroughput: parseInt(row.total_queries || 0),
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error);
      return { averageQueryTime: 0, slowQueries: 0, queryThroughput: 0 };
    }
  }

  private async getStorageMetrics(): Promise<HealthMetrics['storage']> {
    try {
      const storageQuery = `
        SELECT 
          pg_database_size(current_database()) as database_size,
          pg_size_pretty(pg_database_size(current_database())) as size_pretty;
      `;

      const tableSizeQuery = `
        SELECT 
          SUM(pg_total_relation_size(c.oid)) as total_size
        FROM pg_class c
        LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
        WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND c.relkind IN ('r', 'i');
      `;

      const [sizeResult, tableSizeResult] = await Promise.all([
        this.dataSource.query(storageQuery),
        this.dataSource.query(tableSizeQuery),
      ]);

      const databaseSize = parseInt(sizeResult[0]?.database_size || 0);
      const totalSize = parseInt(tableSizeResult[0]?.total_size || 0);

      // Estimate free space (this is simplified)
      const estimatedMaxSize = databaseSize * 1.5; // Assume 50% growth capacity
      const freeSpace = estimatedMaxSize - databaseSize;

      return {
        totalSize: estimatedMaxSize,
        usedSize: databaseSize,
        freeSpace,
        utilizationPercentage: (databaseSize / estimatedMaxSize) * 100,
      };
    } catch (error) {
      this.logger.error('Failed to get storage metrics', error);
      return { totalSize: 0, usedSize: 0, freeSpace: 0, utilizationPercentage: 0 };
    }
  }

  private async getSystemMetrics(): Promise<HealthMetrics['system']> {
    try {
      // These would typically come from system monitoring tools
      // For now, we'll use database-available metrics
      const systemQuery = `
        SELECT 
          CASE 
            WHEN pg_is_in_recovery() THEN 'standby'
            ELSE 'primary'
          END as server_type;
      `;

      const result = await this.dataSource.query(systemQuery);

      // Placeholder values - in production, integrate with system monitoring
      return {
        cpuUsage: Math.random() * 100, // Replace with actual CPU monitoring
        memoryUsage: Math.random() * 100, // Replace with actual memory monitoring
        diskIo: {
          reads: Math.floor(Math.random() * 1000),
          writes: Math.floor(Math.random() * 1000),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get system metrics', error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskIo: { reads: 0, writes: 0 },
      };
    }
  }

  private async getReplicationMetrics(): Promise<HealthMetrics['replication']> {
    try {
      const replicationQuery = `
        SELECT 
          state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as lag_bytes
        FROM pg_stat_replication;
      `;

      const result = await this.dataSource.query(replicationQuery);
      
      if (result.length === 0) {
        return {
          status: 'no_replication',
          lag: 0,
          syncStatus: true,
        };
      }

      const replica = result[0];
      return {
        status: replica.state || 'unknown',
        lag: parseInt(replica.lag_bytes || 0),
        syncStatus: replica.state === 'streaming',
      };
    } catch (error) {
      this.logger.error('Failed to get replication metrics', error);
      return { status: 'error', lag: 0, syncStatus: false };
    }
  }

  private async getLockMetrics(): Promise<HealthMetrics['locks']> {
    try {
      const lockQuery = `
        SELECT 
          COUNT(*) as active_locks,
          COUNT(CASE WHEN NOT granted THEN 1 END) as blocked_queries
        FROM pg_locks;
      `;

      const deadlockQuery = `
        SELECT COUNT(*) as deadlocks
        FROM pg_stat_database 
        WHERE datname = current_database();
      `;

      const [lockResult, deadlockResult] = await Promise.all([
        this.dataSource.query(lockQuery),
        this.dataSource.query(deadlockQuery),
      ]);

      return {
        activeLinks: parseInt(lockResult[0]?.active_locks || 0),
        blockedQueries: parseInt(lockResult[0]?.blocked_queries || 0),
        deadlocks: parseInt(deadlockResult[0]?.deadlocks || 0),
      };
    } catch (error) {
      this.logger.error('Failed to get lock metrics', error);
      return { activeLinks: 0, blockedQueries: 0, deadlocks: 0 };
    }
  }

  private async persistMetrics(metrics: HealthMetrics): Promise<void> {
    const metricEntries = [
      // Connection metrics
      { type: 'connection', name: 'active_connections', value: metrics.connectionPool.active },
      { type: 'connection', name: 'idle_connections', value: metrics.connectionPool.idle },
      { type: 'connection', name: 'total_connections', value: metrics.connectionPool.total },
      { type: 'connection', name: 'connection_utilization', value: metrics.connectionPool.utilization, unit: 'percent' },
      
      // Performance metrics
      { type: 'performance', name: 'avg_query_time', value: metrics.performance.averageQueryTime, unit: 'ms' },
      { type: 'performance', name: 'slow_queries', value: metrics.performance.slowQueries },
      { type: 'performance', name: 'query_throughput', value: metrics.performance.queryThroughput, unit: 'qps' },
      
      // Storage metrics
      { type: 'storage', name: 'used_size', value: metrics.storage.usedSize, unit: 'bytes' },
      { type: 'storage', name: 'utilization', value: metrics.storage.utilizationPercentage, unit: 'percent' },
      
      // System metrics
      { type: 'system', name: 'cpu_usage', value: metrics.system.cpuUsage, unit: 'percent' },
      { type: 'system', name: 'memory_usage', value: metrics.system.memoryUsage, unit: 'percent' },
      
      // Lock metrics
      { type: 'locks', name: 'active_locks', value: metrics.locks.activeLinks },
      { type: 'locks', name: 'blocked_queries', value: metrics.locks.blockedQueries },
    ];

    const entities = metricEntries.map(metric => 
      this.metricRepository.create({
        metricType: metric.type,
        metricName: metric.name,
        value: metric.value,
        unit: metric.unit,
        databaseName: this.dataSource.options.database as string,
      })
    );

    await this.metricRepository.save(entities);
  }

  private async evaluateHealthThresholds(metrics: HealthMetrics): Promise<void> {
    const alerts = [];

    // Connection utilization threshold
    if (metrics.connectionPool.utilization > 80) {
      alerts.push({
        type: 'connection_utilization_high',
        severity: metrics.connectionPool.utilization > 95 ? 'critical' : 'high',
        message: `Connection utilization is ${metrics.connectionPool.utilization.toFixed(1)}%`,
        value: metrics.connectionPool.utilization,
      });
    }

    // Storage utilization threshold
    if (metrics.storage.utilizationPercentage > 85) {
      alerts.push({
        type: 'storage_utilization_high',
        severity: metrics.storage.utilizationPercentage > 95 ? 'critical' : 'high',
        message: `Storage utilization is ${metrics.storage.utilizationPercentage.toFixed(1)}%`,
        value: metrics.storage.utilizationPercentage,
      });
    }

    // Slow queries threshold
    if (metrics.performance.slowQueries > 10) {
      alerts.push({
        type: 'slow_queries_high',
        severity: metrics.performance.slowQueries > 50 ? 'critical' : 'medium',
        message: `${metrics.performance.slowQueries} slow queries detected`,
        value: metrics.performance.slowQueries,
      });
    }

    // Blocked queries threshold
    if (metrics.locks.blockedQueries > 5) {
      alerts.push({
        type: 'blocked_queries_high',
        severity: 'high',
        message: `${metrics.locks.blockedQueries} queries are blocked`,
        value: metrics.locks.blockedQueries,
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.alertingService.sendAlert(alert);
    }
  }

  async getHealthSummary(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: HealthMetrics;
    alerts: any[];
  }> {
    const metrics = await this.gatherHealthMetrics();
    
    // Determine overall health status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (
      metrics.connectionPool.utilization > 95 ||
      metrics.storage.utilizationPercentage > 95 ||
      metrics.locks.blockedQueries > 20
    ) {
      status = 'critical';
    } else if (
      metrics.connectionPool.utilization > 80 ||
      metrics.storage.utilizationPercentage > 85 ||
      metrics.performance.slowQueries > 10 ||
      metrics.locks.blockedQueries > 5
    ) {
      status = 'warning';
    }

    return {
      status,
      metrics,
      alerts: [], // This would be populated with recent alerts
    };
  }
}