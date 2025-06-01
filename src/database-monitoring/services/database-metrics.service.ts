import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { DatabaseMetric } from '../entities/database-metric.entity';

export interface MetricsQuery {
  type?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AggregatedMetricsQuery {
  type: string;
  interval: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class DatabaseMetricsService {
  private readonly logger = new Logger(DatabaseMetricsService.name);

  constructor(
    @InjectRepository(DatabaseMetric)
    private metricRepository: Repository<DatabaseMetric>,
  ) {}

  async getMetrics(query: MetricsQuery) {
    const whereConditions: any = {};
    
    if (query.type) {
      whereConditions.metricType = query.type;
    }
    
    if (query.from && query.to) {
      whereConditions.timestamp = Between(query.from, query.to);
    }

    return await this.metricRepository.find({
      where: whereConditions,
      order: { timestamp: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });
  }

  async getAggregatedMetrics(query: AggregatedMetricsQuery) {
    const intervalMapping = {
      'minute': '1 minute',
      'hour': '1 hour',
      'day': '1 day',
      'week': '1 week',
      'month': '1 month',
    };

    const interval = intervalMapping[query.interval] || '1 hour';
    const fromDate = query.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = query.to || new Date();

    const result = await this.metricRepository.query(`
      SELECT 
        DATE_TRUNC($1, timestamp) as period,
        metric_name,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as sample_count
      FROM database_metrics 
      WHERE metric_type = $2 
        AND timestamp BETWEEN $3 AND $4
      GROUP BY period, metric_name
      ORDER BY period DESC
    `, [interval, query.type, fromDate, toDate]);

    return result;
  }

  async getDashboardSummary() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      connectionMetrics,
      performanceMetrics,
      storageMetrics,
      systemMetrics,
    ] = await Promise.all([
      this.getLatestMetricsByType('connection'),
      this.getLatestMetricsByType('performance'),
      this.getLatestMetricsByType('storage'),
      this.getLatestMetricsByType('system'),
    ]);

    return {
      connections: connectionMetrics,
      performance: performanceMetrics,
      storage: storageMetrics,
      system: systemMetrics,
      lastUpdated: new Date(),
    };
  }

  private async getLatestMetricsByType(type: string) {
    return await this.metricRepository.find({
      where: { metricType: type },
      order: { timestamp: 'DESC' },
      take: 10,
    });
  }
}