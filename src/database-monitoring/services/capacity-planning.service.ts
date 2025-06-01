import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CapacityMetric } from '../entities/capacity-metric.entity';

export interface CapacityQuery {
  from?: Date;
  to?: Date;
  metricType?: string;
}

export interface ForecastResult {
  metricType: string;
  currentValue: number;
  forecastValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  daysToLimit?: number;
  confidence: number;
}

@Injectable()
export class CapacityPlanningService {
  private readonly logger = new Logger(CapacityPlanningService.name);

  constructor(
    @InjectRepository(CapacityMetric)
    private capacityRepository: Repository<CapacityMetric>,
  ) {}

  async getCapacityMetrics(query: CapacityQuery) {
    const whereConditions: any = {};
    
    if (query.metricType) {
      whereConditions.metricType = query.metricType;
    }
    
    if (query.from && query.to) {
      whereConditions.timestamp = Between(query.from, query.to);
    }

    return await this.capacityRepository.find({
      where: whereConditions,
      order: { timestamp: 'DESC' },
      take: 1000,
    });
  }

  async generateForecast(days: number = 30, metricType?: string): Promise<ForecastResult[]> {
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days of historical data
    const toDate = new Date();

    const query: CapacityQuery = { from: fromDate, to: toDate };
    if (metricType) {
      query.metricType = metricType;
    }

    const metrics = await this.getCapacityMetrics(query);
    const groupedMetrics = this.groupMetricsByType(metrics);
    const forecasts: ForecastResult[] = [];

    for (const [type, typeMetrics] of Object.entries(groupedMetrics)) {
      const forecast = this.calculateForecast(typeMetrics, days);
      forecasts.push(forecast);
    }

    return forecasts;
  }

  private groupMetricsByType(metrics: CapacityMetric[]): Record<string, CapacityMetric[]> {
    return metrics.reduce((acc, metric) => {
      if (!acc[metric.metricType]) {
        acc[metric.metricType] = [];
      }
      acc[metric.metricType].push(metric);
      return acc;
    }, {} as Record<string, CapacityMetric[]>);
  }

  private calculateForecast(metrics: CapacityMetric[], days: number): ForecastResult {
    // Sort by timestamp
    const sortedMetrics = metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    if (sortedMetrics.length < 2) {
      return {
        metricType: sortedMetrics[0]?.metricType || 'unknown',
        currentValue: sortedMetrics[0]?.currentValue || 0,
        forecastValue: sortedMetrics[0]?.currentValue || 0,
        trend: 'stable',
        confidence: 0,
      };
    }

    // Calculate linear regression
    const { slope, intercept, rSquared } = this.linearRegression(sortedMetrics);
    
    // Current time in milliseconds since epoch
    const currentTime = Date.now();
    const futureTime = currentTime + (days * 24 * 60 * 60 * 1000);
    
    // Convert to days since first measurement for calculation
    const firstTimestamp = sortedMetrics[0].timestamp.getTime();
    const currentDays = (currentTime - firstTimestamp) / (24 * 60 * 60 * 1000);
    const futureDays = (futureTime - firstTimestamp) / (24 * 60 * 60 * 1000);
    
    const currentValue = sortedMetrics[sortedMetrics.length - 1].currentValue;
    const forecastValue = slope * futureDays + intercept;
    
    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.1) {
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    // Calculate days to limit (assuming 100% is the limit)
    let daysToLimit: number | undefined;
    if (slope > 0 && currentValue < 100) {
      const remainingCapacity = 100 - currentValue;
      daysToLimit = Math.ceil(remainingCapacity / slope);
    }

    return {
      metricType: sortedMetrics[0].metricType,
      currentValue,
      forecastValue: Math.max(0, forecastValue),
      trend,
      daysToLimit,
      confidence: rSquared * 100,
    };
  }

  private linearRegression(metrics: CapacityMetric[]): { slope: number; intercept: number; rSquared: number } {
    const n = metrics.length;
    const firstTimestamp = metrics[0].timestamp.getTime();
    
    const x = metrics.map(m => (m.timestamp.getTime() - firstTimestamp) / (24 * 60 * 60 * 1000)); // days
    const y = metrics.map(m => m.utilizationPercentage);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    
    return { slope, intercept, rSquared: Math.max(0, rSquared) };
  }

  async getRecommendations(): Promise<any[]> {
    const forecasts = await this.generateForecast(30);
    const recommendations: any[] = [];

    for (const forecast of forecasts) {
      if (forecast.daysToLimit && forecast.daysToLimit < 30) {
        recommendations.push({
          type: 'capacity_warning',
          metricType: forecast.metricType,
          severity: forecast.daysToLimit < 7 ? 'high' : 'medium',
          message: `${forecast.metricType} capacity will reach limit in ${forecast.daysToLimit} days`,
          recommendation: this.getCapacityRecommendation(forecast.metricType),
          forecast,
        });
      }

      if (forecast.trend === 'increasing' && forecast.confidence > 80) {
        recommendations.push({
          type: 'growth_trend',
          metricType: forecast.metricType,
          severity: 'low',
          message: `${forecast.metricType} showing consistent growth trend`,
          recommendation: `Monitor ${forecast.metricType} growth and plan for scaling`,
          forecast,
        });
      }
    }

    return recommendations;
  }

  private getCapacityRecommendation(metricType: string): string {
    const recommendations = {
      storage: 'Consider adding more disk space or implementing data archiving strategies',
      memory: 'Increase available RAM or optimize memory usage in applications',
      cpu: 'Scale up compute resources or optimize application performance',
      connections: 'Increase connection pool size or optimize connection usage',
    };

    return recommendations[metricType] || 'Review and optimize resource usage';
  }
}