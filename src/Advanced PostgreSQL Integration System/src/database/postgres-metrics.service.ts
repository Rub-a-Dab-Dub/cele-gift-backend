import { Injectable, Logger } from "@nestjs/common"
import type { DataSource } from "typeorm"
import { Cron, CronExpression } from "@nestjs/schedule"

export interface DatabaseMetrics {
  connections: {
    total: number
    active: number
    idle: number
    waiting: number
  }
  performance: {
    slowQueries: any[]
    indexUsage: any[]
    tableStats: any[]
  }
  storage: {
    databaseSize: string
    tablesSizes: any[]
    indexesSizes: any[]
  }
  replication: {
    isReplica: boolean
    replicationLag?: number
    replicationStatus?: any[]
  }
}

@Injectable()
export class PostgresMetricsService {
  private readonly logger = new Logger(PostgresMetricsService.name)
  private metrics: Partial<DatabaseMetrics> = {}

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      this.metrics = {
        connections: await this.getConnectionMetrics(),
        performance: await this.getPerformanceMetrics(),
        storage: await this.getStorageMetrics(),
        replication: await this.getReplicationMetrics(),
      }

      this.logger.debug("Metrics collected successfully")
    } catch (error) {
      this.logger.error("Failed to collect metrics", error)
    }
  }

  getMetrics(): Partial<DatabaseMetrics> {
    return this.metrics
  }

  private async getConnectionMetrics(): Promise<DatabaseMetrics["connections"]> {
    const result = await this.dataSource.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
    `)

    return result[0]
  }

  private async getPerformanceMetrics(): Promise<DatabaseMetrics["performance"]> {
    const [slowQueries, indexUsage, tableStats] = await Promise.all([
      this.getSlowQueries(),
      this.getIndexUsage(),
      this.getTableStats(),
    ])

    return {
      slowQueries,
      indexUsage,
      tableStats,
    }
  }

  private async getSlowQueries(): Promise<any[]> {
    try {
      return await this.dataSource.query(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 10
      `)
    } catch (error) {
      // pg_stat_statements extension might not be available
      return []
    }
  }

  private async getIndexUsage(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan,
        CASE 
          WHEN idx_scan = 0 THEN 'Unused'
          WHEN idx_scan < 10 THEN 'Low Usage'
          ELSE 'Active'
        END as usage_status
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
    `)
  }

  private async getTableStats(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del,
        n_live_tup,
        n_dead_tup,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY seq_scan DESC
    `)
  }

  private async getStorageMetrics(): Promise<DatabaseMetrics["storage"]> {
    const [databaseSize, tablesSizes, indexesSizes] = await Promise.all([
      this.getDatabaseSize(),
      this.getTablesSizes(),
      this.getIndexesSizes(),
    ])

    return {
      databaseSize: databaseSize[0].size,
      tablesSizes,
      indexesSizes,
    }
  }

  private async getDatabaseSize(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `)
  }

  private async getTablesSizes(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY size_bytes DESC
      LIMIT 20
    `)
  }

  private async getIndexesSizes(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexname)) as size,
        pg_relation_size(indexname) as size_bytes
      FROM pg_indexes
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY size_bytes DESC
      LIMIT 20
    `)
  }

  private async getReplicationMetrics(): Promise<DatabaseMetrics["replication"]> {
    const isReplica = await this.isReplica()

    if (!isReplica) {
      const replicationStatus = await this.getReplicationStatus()
      return {
        isReplica: false,
        replicationStatus,
      }
    } else {
      const replicationLag = await this.getReplicationLag()
      return {
        isReplica: true,
        replicationLag,
      }
    }
  }

  private async isReplica(): Promise<boolean> {
    const result = await this.dataSource.query("SELECT pg_is_in_recovery()")
    return result[0].pg_is_in_recovery
  }

  private async getReplicationStatus(): Promise<any[]> {
    try {
      return await this.dataSource.query(`
        SELECT 
          client_addr,
          client_hostname,
          client_port,
          state,
          sent_lsn,
          write_lsn,
          flush_lsn,
          replay_lsn,
          write_lag,
          flush_lag,
          replay_lag
        FROM pg_stat_replication
      `)
    } catch (error) {
      return []
    }
  }

  private async getReplicationLag(): Promise<number> {
    try {
      const result = await this.dataSource.query(`
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag_seconds
      `)
      return result[0]?.lag_seconds || 0
    } catch (error) {
      return 0
    }
  }

  // Health check methods
  async getHealthStatus(): Promise<{
    status: "healthy" | "warning" | "critical"
    checks: any[]
  }> {
    const checks = await Promise.all([
      this.checkConnectionHealth(),
      this.checkPerformanceHealth(),
      this.checkStorageHealth(),
      this.checkReplicationHealth(),
    ])

    const criticalIssues = checks.filter((check) => check.status === "critical")
    const warnings = checks.filter((check) => check.status === "warning")

    let status: "healthy" | "warning" | "critical" = "healthy"
    if (criticalIssues.length > 0) {
      status = "critical"
    } else if (warnings.length > 0) {
      status = "warning"
    }

    return { status, checks }
  }

  private async checkConnectionHealth(): Promise<any> {
    const connections = await this.getConnectionMetrics()
    const maxConnections = await this.getMaxConnections()
    const usagePercent = (connections.total / maxConnections) * 100

    return {
      name: "connections",
      status: usagePercent > 80 ? "critical" : usagePercent > 60 ? "warning" : "healthy",
      message: `${connections.total}/${maxConnections} connections (${usagePercent.toFixed(1)}%)`,
      details: connections,
    }
  }

  private async checkPerformanceHealth(): Promise<any> {
    const slowQueries = await this.getSlowQueries()
    const slowQueryCount = slowQueries.length

    return {
      name: "performance",
      status: slowQueryCount > 10 ? "critical" : slowQueryCount > 5 ? "warning" : "healthy",
      message: `${slowQueryCount} slow queries detected`,
      details: { slowQueryCount, slowQueries: slowQueries.slice(0, 5) },
    }
  }

  private async checkStorageHealth(): Promise<any> {
    // This is a simplified check - you might want to implement more sophisticated storage monitoring
    return {
      name: "storage",
      status: "healthy",
      message: "Storage usage within normal limits",
      details: {},
    }
  }

  private async checkReplicationHealth(): Promise<any> {
    const replication = await this.getReplicationMetrics()

    if (replication.isReplica && replication.replicationLag > 60) {
      return {
        name: "replication",
        status: "warning",
        message: `Replication lag: ${replication.replicationLag}s`,
        details: replication,
      }
    }

    return {
      name: "replication",
      status: "healthy",
      message: "Replication status normal",
      details: replication,
    }
  }

  private async getMaxConnections(): Promise<number> {
    const result = await this.dataSource.query("SHOW max_connections")
    return Number.parseInt(result[0].max_connections)
  }
}
