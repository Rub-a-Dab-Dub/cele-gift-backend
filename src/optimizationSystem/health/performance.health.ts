
// 📁 health/
// health/performance.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { QueryMonitorService } from '../services/query-monitor.service';
import { QueryCacheService } from '../services/cache.service';

@Injectable()
export class PerformanceHealthIndicator extends HealthIndicator {
  constructor(
    private readonly queryMonitor: QueryMonitorService,
    private readonly cacheService: QueryCacheService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const slowQueries = this.queryMonitor.getSlowQueries(5000); // 5 second threshold
    const cacheStats = this.cacheService.getStats();
    const recentMetrics = this.queryMonitor.getAllMetrics()
      .filter(m => Date.now() - m.timestamp.getTime() < 5 * 60 * 1000); // Last 5 minutes

    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length 
      : 0;

    const isHealthy = slowQueries.length < 5 && avgResponseTime < 1000;

    const result = this.getStatus(key, isHealthy, {
      slowQueries: slowQueries.length,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: cacheStats.totalHits > 0 ? (cacheStats.totalHits / (cacheStats.totalHits + recentMetrics.length)) * 100 : 0,
      totalCacheEntries: cacheStats.totalEntries,
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError('Performance check failed', result);
  }
}
