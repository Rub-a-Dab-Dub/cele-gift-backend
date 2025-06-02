import { Injectable } from '@nestjs/common';
import { PerformanceReport } from '../interfaces/performance.interface';
import { QueryMonitorService } from './query-monitor.service';
import { QueryAnalyzerService } from './query-analyzer.service';
import { QueryCacheService } from './cache.service';
import { PerformanceRegressionService } from './performance-regression.service';

@Injectable()
export class PerformanceReportService {
  constructor(
    private readonly queryMonitor: QueryMonitorService,
    private readonly queryAnalyzer: QueryAnalyzerService,
    private readonly cacheService: QueryCacheService,
    private readonly regressionService: PerformanceRegressionService,
  ) {}

  async generateReport(startDate: Date, endDate: Date): Promise<PerformanceReport> {
    const allMetrics = this.queryMonitor.getAllMetrics();
    const periodMetrics = allMetrics.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    );

    const totalQueries = periodMetrics.length;
    const avgExecutionTime = totalQueries > 0 
      ? periodMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries 
      : 0;

    const slowQueries = this.queryMonitor.getSlowQueries().filter(
      q => q.timestamp >= startDate && q.timestamp <= endDate
    );

    const uniqueQueries = [...new Set(slowQueries.map(q => q.sql))];
    const indexSuggestions = await this.queryAnalyzer.suggestIndexes(uniqueQueries);

    const cacheStats = this.cacheService.getStats();
    const cacheHitRate = cacheStats.totalHits > 0 
      ? cacheStats.totalHits / (cacheStats.totalHits + totalQueries) 
      : 0;

    const regressions = this.regressionService.getAllRegressions().filter(
      r => r.detectedAt >= startDate && r.detectedAt <= endDate
    );

    return {
      period: { start: startDate, end: endDate },
      totalQueries,
      avgExecutionTime,
      slowQueries: slowQueries.slice(0, 20), // Top 20 slowest
      indexSuggestions,
      cacheHitRate,
      regressions,
    };
  }
}
