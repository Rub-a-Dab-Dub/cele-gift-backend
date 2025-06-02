import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { QueryMonitorService } from '../services/query-monitor.service';
import { QueryAnalyzerService } from '../services/query-analyzer.service';
import { QueryCacheService } from '../services/cache.service';
import { PerformanceRegressionService } from '../services/performance-regression.service';
import { PerformanceReportService } from '../services/performance-report.service';

@Controller('performance')
export class PerformanceDashboardController {
  constructor(
    private readonly queryMonitor: QueryMonitorService,
    private readonly queryAnalyzer: QueryAnalyzerService,
    private readonly cacheService: QueryCacheService,
    private readonly regressionService: PerformanceRegressionService,
    private readonly reportService: PerformanceReportService,
  ) {}

  @Get('dashboard')
  async getDashboard() {
    const slowQueries = this.queryMonitor.getSlowQueries();
    const cacheStats = this.cacheService.getStats();
    const recentRegressions = this.regressionService.getRecentRegressions();

    return {
      slowQueries: slowQueries.slice(0, 10), // Top 10 slowest
      cacheStats,
      recentRegressions,
      totalQueries: this.queryMonitor.getAllMetrics().length,
    };
  }

  @Get('slow-queries')
  async getSlowQueries(@Query('threshold') threshold?: string) {
    const thresholdMs = threshold ? parseInt(threshold) : undefined;
    return this.queryMonitor.getSlowQueries(thresholdMs);
  }

  @Post('analyze-query')
  async analyzeQuery(@Body() body: { sql: string; parameters?: any[] }) {
    return this.queryAnalyzer.analyzeQuery(body.sql, body.parameters);
  }

  @Get('index-suggestions')
  async getIndexSuggestions() {
    const slowQueries = this.queryMonitor.getSlowQueries();
    const queries = slowQueries.map(q => q.sql);
    return this.queryAnalyzer.suggestIndexes(queries);
  }

  @Get('cache-stats')
  async getCacheStats() {
    return this.cacheService.getStats();
  }

  @Post('cache/invalidate')
  async invalidateCache(@Body() body: { tags: string[] }) {
    const deletedCount = this.cacheService.invalidateByTags(body.tags);
    return { message: `Invalidated ${deletedCount} cache entries` };
  }

  @Get('regressions')
  async getRegressions(@Query('hours') hours?: string) {
    const hoursNum = hours ? parseInt(hours) : 24;
    return this.regressionService.getRecentRegressions(hoursNum);
  }

  @Get('report')
  async getPerformanceReport(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startDate = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end) : new Date();
    
    return this.reportService.generateReport(startDate, endDate);
  }
}