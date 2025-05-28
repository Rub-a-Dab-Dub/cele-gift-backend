import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseEnvironmentConfig } from '../config/database-config.interface';

export interface QueryLog {
  query: string;
  parameters?: any[];
  duration: number;
  timestamp: Date;
  connection: 'primary' | 'read';
  error?: string;
}

@Injectable()
export class DatabaseLoggerService {
  private readonly logger = new Logger(DatabaseLoggerService.name);
  private readonly queryLogs: QueryLog[] = [];
  private readonly maxLogSize = 1000;

  constructor(private configService: ConfigService) {}

  private getDatabaseConfig(): DatabaseEnvironmentConfig {
    const env = process.env.NODE_ENV || 'development';
    return this.configService.get(`database.${env}`);
  }

  logQuery(queryLog: QueryLog): void {
    const config = this.getDatabaseConfig();
    
    if (!config.logging.enabled) {
      return;
    }

    // in-memory log
    this.queryLogs.push(queryLog);
    if (this.queryLogs.length > this.maxLogSize) {
      this.queryLogs.shift();
    }

    // Log based on configuration
    const logLevel = config.logging.level;
    const isSlowQuery = queryLog.duration > config.logging.slowQueryThreshold;
    
    const logMessage = {
      query: this.sanitizeQuery(queryLog.query),
      duration: queryLog.duration,
      connection: queryLog.connection,
      timestamp: queryLog.timestamp,
      ...(queryLog.error && { error: queryLog.error }),
    };

    if (queryLog.error) {
      this.logger.error('Database query failed', logMessage);
    } else if (isSlowQuery) {
      this.logger.warn('Slow query detected', logMessage);
    } else {
      switch (logLevel) {
        case 'debug':
          this.logger.debug('Database query executed', logMessage);
          break;
        case 'info':
          this.logger.log('Database query executed', logMessage);
          break;
        case 'warn':
          if (isSlowQuery) {
            this.logger.warn('Database query executed', logMessage);
          }
          break;
        case 'error':
          // Only log errors
          break;
      }
    }
  }

  private sanitizeQuery(query: string): string {
    
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'");
  }

  getRecentQueries(limit: number = 50): QueryLog[] {
    return this.queryLogs.slice(-limit);
  }

  getSlowQueries(threshold?: number): QueryLog[] {
    const config = this.getDatabaseConfig();
    const slowThreshold = threshold || config.logging.slowQueryThreshold;
    
    return this.queryLogs.filter(log => log.duration > slowThreshold);
  }

  getQueryStats() {
    const totalQueries = this.queryLogs.length;
    const avgDuration = totalQueries > 0 
      ? this.queryLogs.reduce((sum, log) => sum + log.duration, 0) / totalQueries 
      : 0;
    
    const config = this.getDatabaseConfig();
    const slowQueries = this.queryLogs.filter(
      log => log.duration > config.logging.slowQueryThreshold
    ).length;
    
    const errorQueries = this.queryLogs.filter(log => log.error).length;

    return {
      totalQueries,
      avgDuration: Math.round(avgDuration),
      slowQueries,
      errorQueries,
      slowQueryPercentage: totalQueries > 0 ? (slowQueries / totalQueries) * 100 : 0,
      errorPercentage: totalQueries > 0 ? (errorQueries / totalQueries) * 100 : 0,
    };
  }
}