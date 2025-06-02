import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueryMonitorService } from '../services/query-monitor.service';
import { QueryCacheService } from '../services/cache.service';
import { PerformanceRegressionService } from '../services/performance-regression.service';

@Injectable()
export class PerformanceCleanupScheduler {
  private readonly logger = new Logger(PerformanceCleanupScheduler.name);

  constructor(
    private readonly queryMonitor: QueryMonitorService,
    private readonly cacheService: QueryCacheService,
    private readonly regressionService: PerformanceRegressionService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldMetrics() {
    this.logger.log('Starting performance metrics cleanup...');
    
    try {
      // In a real implementation, you'd clean up old metrics from the QueryMonitorService
      // For now, we'll just log the action
      const allMetrics = this.queryMonitor.getAllMetrics();
      const oldMetricsCount = allMetrics.filter(
        m => Date.now() - m.timestamp.getTime() > 24 * 60 * 60 * 1000 // Older than 24 hours
      ).length;

      this.logger.log(`Found ${oldMetricsCount} old metrics to clean up`);
      
      // Cache cleanup happens automatically in the cache service
      const cacheStats = this.cacheService.getStats();
      this.logger.log(`Current cache stats: ${JSON.stringify(cacheStats)}`);

    } catch (error) {
      this.logger.error('Error during performance cleanup', error.stack);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async updatePerformanceBaselines() {
    this.logger.log('Updating performance baselines...');
    
    try {
      const allMetrics = this.queryMonitor.getAllMetrics();
      const recentMetrics = allMetrics.filter(
        m => Date.now() - m.timestamp.getTime() < 6 * 60 * 60 * 1000 // Last 6 hours
      );

      // Group by queryId and calculate averages
      const queryGroups = new Map<string, number[]>();
      
      for (const metric of recentMetrics) {
        if (!queryGroups.has(metric.queryId)) {
          queryGroups.set(metric.queryId, []);
        }
        queryGroups.get(metric.queryId)!.push(metric.executionTime);
      }

      // Update baselines
      for (const [queryId, times] of queryGroups.entries()) {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        this.regressionService.updateBaseline(queryId, avgTime);
      }

      this.logger.log(`Updated baselines for ${queryGroups.size} queries`);
    } catch (error) {
      this.logger.error('Error updating performance baselines', error.stack);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReport() {
    this.logger.log('Generating daily performance report...');
    
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const today = new Date();
      
      const slowQueries = this.queryMonitor.getSlowQueries();
      const recentRegressions = this.regressionService.getRecentRegressions(24);
      
      const report = {
        date: yesterday.toISOString().split('T')[0],
        slowQueriesCount: slowQueries.length,
        regressionsCount: recentRegressions.length,
        topSlowQueries: slowQueries.slice(0, 5).map(q => ({
          queryId: q.queryId,
          executionTime: q.executionTime,
          timestamp: q.timestamp,
        })),
      };

      this.logger.log(`Daily report generated: ${JSON.stringify(report)}`);
      
      // In a real implementation, you might send this to monitoring systems
      // or store it in a database for historical analysis
      
    } catch (error) {
      this.logger.error('Error generating daily report', error.stack);
    }
  }
}