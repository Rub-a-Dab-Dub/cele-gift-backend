import { Injectable, Logger } from '@nestjs/common';
import { PerformanceRegression, QueryPerformanceMetrics } from '../interfaces/performance.interface';

@Injectable()
export class PerformanceRegressionService {
  private readonly logger = new Logger(PerformanceRegressionService.name);
  private readonly baseline = new Map<string, number>();
  private readonly regressions: PerformanceRegression[] = [];

  updateBaseline(queryId: string, avgExecutionTime: number): void {
    this.baseline.set(queryId, avgExecutionTime);
  }

  checkForRegression(metrics: QueryPerformanceMetrics): PerformanceRegression | null {
    const baselineTime = this.baseline.get(metrics.queryId);
    
    if (!baselineTime) {
      // No baseline yet, set current as baseline
      this.baseline.set(metrics.queryId, metrics.executionTime);
      return null;
    }

    const degradationPercent = ((metrics.executionTime - baselineTime) / baselineTime) * 100;
    
    // Consider it a regression if performance degraded by more than 50%
    if (degradationPercent > 50) {
      const regression: PerformanceRegression = {
        queryId: metrics.queryId,
        previousAvgTime: baselineTime,
        currentAvgTime: metrics.executionTime,
        degradationPercent,
        detectedAt: new Date(),
      };

      this.regressions.push(regression);
      
      this.logger.warn(`Performance regression detected for query ${metrics.queryId}`, {
        degradation: `${degradationPercent.toFixed(2)}%`,
        previousTime: baselineTime,
        currentTime: metrics.executionTime,
      });

      return regression;
    }

    return null;
  }

  getRecentRegressions(hours: number = 24): PerformanceRegression[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.regressions.filter(r => r.detectedAt > cutoff);
  }

  getAllRegressions(): PerformanceRegression[] {
    return [...this.regressions];
  }

  clearRegressions(): void {
    this.regressions.length = 0;
  }
}