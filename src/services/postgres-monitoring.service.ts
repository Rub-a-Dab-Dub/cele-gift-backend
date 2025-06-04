export class PostgreSQLMonitoringService {
    constructor(private dataSource: DataSource) {}
  
    async getMetrics(): Promise<PostgreSQLMetrics> {
      // Active connections
      const [connectionsResult] = await this.dataSource.query(`
        SELECT count(*) as active, 
               (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max
        FROM pg_stat_activity 
        WHERE state = 'active'
      `);
  
      // Database size
      const [sizeResult] = await this.dataSource.query(`
        SELECT pg_database_size(current_database()) as size
      `);
  
      // Hit ratios
      const [hitRatioResult] = await this.dataSource.query(`
        SELECT 
          CASE WHEN blks_hit + blks_read > 0 
            THEN (blks_hit::float / (blks_hit + blks_read) * 100)::numeric(5,2)
            ELSE 0 
          END as buffer_hit_ratio,
          CASE WHEN idx_blks_hit + idx_blks_read > 0
            THEN (idx_blks_hit::float / (idx_blks_hit + idx_blks_read) * 100)::numeric(5,2)
            ELSE 0
          END as index_hit_ratio
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);
  
      // Deadlocks
      const [deadlocksResult] = await this.dataSource.query(`
        SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()
      `);
  
      return {
        activeConnections: parseInt(connectionsResult.active),
        totalConnections: parseInt(connectionsResult.max),
        databaseSize: parseInt(sizeResult.size),
        indexHitRatio: parseFloat(hitRatioResult.index_hit_ratio),
        bufferHitRatio: parseFloat(hitRatioResult.buffer_hit_ratio),
        deadlocks: parseInt(deadlocksResult.deadlocks),
        slowQueries: 0 // Would need pg_stat_statements extension
      };
    }
  
    async getSlowQueries(limit = 10): Promise<any[]> {
      try {
        return await this.dataSource.query(`
          SELECT 
            query,
            calls,
            total_time,
            mean_time,
            (total_time / calls) as avg_time
          FROM pg_stat_statements
          ORDER BY total_time DESC
          LIMIT $1
        `, [limit]);
      } catch (error) {
        console.warn('pg_stat_statements extension not available');
        return [];
      }
    }
  
    async getBlockingQueries(): Promise<any[]> {
      return this.dataSource.query(`
        SELECT 
          blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS blocking_statement
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.GRANTED
      `);
    }
  }