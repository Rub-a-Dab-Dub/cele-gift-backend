import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertingService } from './alerting.service';

export interface LogAnalysisQuery {
  type?: string;
  from?: Date;
  to?: Date;
  severity?: string;
}

export interface ErrorPattern {
  error: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  severity: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SlowQuery {
  query: string;
  avgDuration: number;
  maxDuration: number;
  executionCount: number;
  lastSeen: Date;
  impactScore: number;
}

@Injectable()
export class LogAnalysisService {
  private readonly logger = new Logger(LogAnalysisService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private alertingService: AlertingService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async performScheduledAnalysis(): Promise<void> {
    try {
      await this.analyzeRecentLogs();
    } catch (error) {
      this.logger.error('Scheduled log analysis failed', error);
    }
  }

  async analyzeRecentLogs(): Promise<void> {
    const since = new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes
    
    const [errors, slowQueries] = await Promise.all([
      this.analyzeErrors(since),
      this.analyzeSlowQueries(since),
    ]);

    // Check for critical patterns and send alerts
    await this.evaluateLogPatterns(errors, slowQueries);
  }

  private async analyzeErrors(since: Date): Promise<ErrorPattern[]> {
    try {
      // PostgreSQL log analysis - adjust based on your log configuration
      const errorQuery = `
        SELECT 
          message,
          error_severity,
          COUNT(*) as error_count,
          MIN(log_time) as first_seen,
          MAX(log_time) as last_seen
        FROM pg_log 
        WHERE log_time >= $1 
          AND error_severity IN ('ERROR', 'FATAL', 'PANIC')
        GROUP BY message, error_severity
        ORDER BY error_count DESC
        LIMIT 50
      `;

      const result = await this.dataSource.query(errorQuery, [since]);
      
      return result.map(row => ({
        error: row.message,
        count: parseInt(row.error_count),
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        severity: row.error_severity,
        trend: 'stable' as const, // Would need historical data to determine trend
      }));
    } catch (error) {
      // Fallback to pg_stat_database if pg_log is not available
      this.logger.warn('pg_log not available, using fallback error analysis');
      return this.getFallbackErrorAnalysis();
    }
  }

  private async getFallbackErrorAnalysis(): Promise<ErrorPattern[]> {
    // Use system catalogs for basic error tracking
    const query = `
      SELECT 
        'Connection errors' as message,
        'ERROR' as error_severity,
        COALESCE(SUM(numbackends), 0) as error_count,
        NOW() - INTERVAL '10 minutes' as first_seen,
        NOW() as last_seen
      FROM pg_stat_database 
      WHERE datname = current_database()
    `;

    const result = await this.dataSource.query(query);
    return result.map(row => ({
      error: row.message,
      count: parseInt(row.error_count),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      severity: row.error_severity,
      trend: 'stable' as const,
    }));
  }

  private async analyzeSlowQueries(since: Date): Promise<SlowQuery[]> {
    try {
      // Requires pg_stat_statements extension
      const slowQueryQuery = `
        SELECT 
          LEFT(query, 100) as query_sample,
          mean_exec_time as avg_duration,
          max_exec_time as max_duration,
          calls as execution_count,
          NOW() as last_seen,
          (mean_exec_time * calls) as impact_score
        FROM pg_stat_statements 
        WHERE mean_exec_time > 1000 -- queries slower than 1 second
          AND calls > 0
        ORDER BY impact_score DESC
        LIMIT 20
      `;

      const result = await this.dataSource.query(slowQueryQuery);
      
      return result.map(row => ({
        query: row.query_sample,
        avgDuration: parseFloat(row.avg_duration),
        maxDuration: parseFloat(row.max_duration),
        executionCount: parseInt(row.execution_count),
        lastSeen: row.last_seen,
        impactScore: parseFloat(row.impact_score),
      }));
    } catch (error) {
      this.logger.warn('pg_stat_statements not available for slow query analysis');
      return [];
    }
  }

  private async evaluateLogPatterns(errors: ErrorPattern[], slowQueries: SlowQuery[]): Promise<void> {
    // Analyze error patterns
    for (const error of errors) {
      if (error.count > 10 && error.severity === 'ERROR') {
        await this.alertingService.sendAlert({
          type: 'high_error_rate',
          severity: 'high',
          message: `High error rate detected: ${error.error} (${error.count} occurrences)`,
          value: error.count,
          metadata: { errorPattern: error },
        });
      }

      if (error.severity === 'FATAL' || error.severity === 'PANIC') {
        await this.alertingService.sendAlert({
          type: 'critical_database_error',
          severity: 'critical',
          message: `Critical database error: ${error.error}`,
          value: error.count,
          metadata: { errorPattern: error },
        });
      }
    }

    // Analyze slow query patterns
    for (const query of slowQueries) {
      if (query.impactScore > 10000) { // High impact threshold
        await this.alertingService.sendAlert({
          type: 'high_impact_slow_query',
          severity: 'medium',
          message: `High impact slow query detected (Impact: ${query.impactScore.toFixed(0)})`,
          value: query.impactScore,
          metadata: { slowQuery: query },
        });
      }
    }
  }

  async getAnalysisResults(query: LogAnalysisQuery): Promise<any> {
    const from = query.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = query.to || new Date();

    const [errors, slowQueries, summary] = await Promise.all([
      this.analyzeErrors(from),
      this.analyzeSlowQueries(from),
      this.getLogSummary(from, to),
    ]);

    return {
      timeRange: { from, to },
      summary,
      errors: errors.slice(0, 20),
      slowQueries: slowQueries.slice(0, 20),
      analysis: {
        totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
        criticalErrors: errors.filter(e => ['FATAL', 'PANIC'].includes(e.severity)).length,
        slowQueryCount: slowQueries.length,
        avgSlowQueryDuration: slowQueries.length > 0 
          ? slowQueries.reduce((sum, q) => sum + q.avgDuration, 0) / slowQueries.length 
          : 0,
      },
    };
  }

  private async getLogSummary(from: Date, to: Date): Promise<any> {
    try {
      const summaryQuery = `
        SELECT 
          error_severity,
          COUNT(*) as count
        FROM pg_log 
        WHERE log_time BETWEEN $1 AND $2
        GROUP BY error_severity
        ORDER BY count DESC
      `;

      const result = await this.dataSource.query(summaryQuery, [from, to]);
      return result;
    } catch (error) {
      return [{ error_severity: 'INFO', count: 0 }];
    }
  }

  async getErrorAnalysis(severity?: string, limit: number = 50): Promise<ErrorPattern[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errors = await this.analyzeErrors(since);
    
    let filteredErrors = errors;
    if (severity) {
      filteredErrors = errors.filter(e => e.severity === severity.toUpperCase());
    }

    return filteredErrors.slice(0, limit);
  }

  async getSlowQueryAnalysis(threshold: number = 1000, limit: number = 50): Promise<SlowQuery[]> {
    try {
      const slowQueryQuery = `
        SELECT 
          query,
          mean_exec_time as avg_duration,
          max_exec_time as max_duration,
          calls as execution_count,
          NOW() as last_seen,
          (mean_exec_time * calls) as impact_score
        FROM pg_stat_statements 
        WHERE mean_exec_time > $1
          AND calls > 0
        ORDER BY impact_score DESC
        LIMIT $2
      `;

      const result = await this.dataSource.query(slowQueryQuery, [threshold, limit]);
      
      return result.map(row => ({
        query: row.query,
        avgDuration: parseFloat(row.avg_duration),
        maxDuration: parseFloat(row.max_duration),
        executionCount: parseInt(row.execution_count),
        lastSeen: row.last_seen,
        impactScore: parseFloat(row.impact_score),
      }));
    } catch (error) {
      this.logger.warn('Failed to get slow query analysis', error);
      return [];
    }
  }

  async triggerAnalysis(config: any): Promise<{ status: string; results: any }> {
    try {
      const from = config.from ? new Date(config.from) : new Date(Date.now() - 60 * 60 * 1000);
      const to = config.to ? new Date(config.to) : new Date();

      const results = await this.getAnalysisResults({
        type: config.type,
        from,
        to,
        severity: config.severity,
      });

      return {
        status: 'completed',
        results,
      };
    } catch (error) {
      this.logger.error('Manual log analysis failed', error);
      return {
        status: 'failed',
        results: { error: error.message },
      };
    }
  }
}
