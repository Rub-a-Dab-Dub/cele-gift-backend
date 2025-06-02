import { Injectable, Logger } from '@nestjs/common';
import { QueryPerformanceMetrics, QueryPlan } from '../interfaces/performance.interface';

@Injectable()
export class QueryMonitorService {
  private readonly logger = new Logger(QueryMonitorService.name);
  private readonly metrics: Map<string, QueryPerformanceMetrics[]> = new Map();
  private readonly slowQueryThreshold = 1000; // 1 second

  recordQuery(metrics: QueryPerformanceMetrics): void {
    const queryHash = this.hashQuery(metrics.sql);
    
    if (!this.metrics.has(queryHash)) {
      this.metrics.set(queryHash, []);
    }
    
    this.metrics.get(queryHash)!.push(metrics);
    
    // Log slow queries immediately
    if (metrics.executionTime > this.slowQueryThreshold) {
      this.logger.warn(`Slow query detected: ${metrics.executionTime}ms`, {
        sql: metrics.sql,
        parameters: metrics.parameters,
        endpoint: metrics.endpoint,
      });
    }
    
    // Cleanup old metrics (keep last 1000 per query)
    const queryMetrics = this.metrics.get(queryHash)!;
    if (queryMetrics.length > 1000) {
      queryMetrics.splice(0, queryMetrics.length - 1000);
    }
  }

  getSlowQueries(threshold?: number): QueryPerformanceMetrics[] {
    const limit = threshold || this.slowQueryThreshold;
    const slowQueries: QueryPerformanceMetrics[] = [];
    
    for (const metrics of this.metrics.values()) {
      slowQueries.push(...metrics.filter(m => m.executionTime > limit));
    }
    
    return slowQueries.sort((a, b) => b.executionTime - a.executionTime);
  }

  getQueryStatistics(queryHash: string) {
    const metrics = this.metrics.get(queryHash) || [];
    if (metrics.length === 0) return null;
    
    const executionTimes = metrics.map(m => m.executionTime);
    const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const minTime = Math.min(...executionTimes);
    const maxTime = Math.max(...executionTimes);
    
    return {
      queryHash,
      totalExecutions: metrics.length,
      avgExecutionTime: avgTime,
      minExecutionTime: minTime,
      maxExecutionTime: maxTime,
      lastExecuted: metrics[metrics.length - 1].timestamp,
    };
  }

  getAllMetrics(): QueryPerformanceMetrics[] {
    const allMetrics: QueryPerformanceMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private hashQuery(sql: string): string {
    // Simple hash function for SQL queries
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}