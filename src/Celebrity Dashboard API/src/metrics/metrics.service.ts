import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { MetricData } from "./entities/metric-data.entity"
import { type DashboardQueryDto, TimeRange } from "../dashboard/dto/dashboard-query.dto"

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name)

  constructor(private metricDataRepository: Repository<MetricData>) {}

  async getAggregatedMetrics(query: DashboardQueryDto) {
    const { timeRange, startDate, endDate, celebrityId, metrics, platforms } = query

    const queryBuilder = this.metricDataRepository
      .createQueryBuilder("metric")
      .select([
        "metric.metricType",
        "metric.platform",
        "AVG(metric.value) as avgValue",
        "SUM(metric.value) as totalValue",
        "MAX(metric.value) as maxValue",
        "MIN(metric.value) as minValue",
        "COUNT(*) as dataPoints",
        "DATE_TRUNC(:interval, metric.timestamp) as timeGroup",
      ])
      .groupBy("metric.metricType, metric.platform, timeGroup")
      .orderBy("timeGroup", "ASC")

    // Apply filters
    if (celebrityId) {
      queryBuilder.andWhere("metric.celebrityId = :celebrityId", { celebrityId })
    }

    if (metrics && metrics.length > 0) {
      queryBuilder.andWhere("metric.metricType IN (:...metrics)", { metrics })
    }

    if (platforms && platforms.length > 0) {
      queryBuilder.andWhere("metric.platform IN (:...platforms)", { platforms })
    }

    // Time range filtering
    const timeInterval = this.getTimeInterval(timeRange)
    queryBuilder.setParameter("interval", timeInterval)

    if (startDate && endDate) {
      queryBuilder.andWhere("metric.timestamp BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
    } else if (timeRange) {
      const timeFilter = this.getTimeFilter(timeRange)
      queryBuilder.andWhere("metric.timestamp >= :timeFilter", { timeFilter })
    }

    const results = await queryBuilder.getRawMany()

    return this.processAggregatedResults(results)
  }

  async getComparativeMetrics(query: DashboardQueryDto) {
    // Get industry benchmarks and peer comparisons
    const industryAvg = await this.getIndustryAverages(query)
    const peerComparison = await this.getPeerComparison(query)

    return {
      industryAverages: industryAvg,
      peerComparison,
      percentileRanking: await this.getPercentileRanking(query),
    }
  }

  async getRealTimeMetrics(celebrityId: string) {
    // Get the most recent metrics for real-time dashboard
    return this.metricDataRepository
      .createQueryBuilder("metric")
      .where("metric.celebrityId = :celebrityId", { celebrityId })
      .andWhere("metric.timestamp >= NOW() - INTERVAL '1 hour'")
      .orderBy("metric.timestamp", "DESC")
      .getMany()
  }

  private getTimeInterval(timeRange: TimeRange): string {
    const intervals = {
      [TimeRange.HOUR]: "minute",
      [TimeRange.DAY]: "hour",
      [TimeRange.WEEK]: "day",
      [TimeRange.MONTH]: "day",
      [TimeRange.QUARTER]: "week",
      [TimeRange.YEAR]: "month",
    }
    return intervals[timeRange] || "hour"
  }

  private getTimeFilter(timeRange: TimeRange): Date {
    const now = new Date()
    const filters = {
      [TimeRange.HOUR]: new Date(now.getTime() - 60 * 60 * 1000),
      [TimeRange.DAY]: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      [TimeRange.WEEK]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      [TimeRange.MONTH]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      [TimeRange.QUARTER]: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      [TimeRange.YEAR]: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    }
    return filters[timeRange] || filters[TimeRange.DAY]
  }

  private processAggregatedResults(results: any[]) {
    const processed = {
      totalDataPoints: 0,
      metrics: {},
      timeSeries: [],
    }

    results.forEach((row) => {
      const { metrictype, platform, avgvalue, totalvalue, maxvalue, minvalue, datapoints, timegroup } = row

      if (!processed.metrics[metrictype]) {
        processed.metrics[metrictype] = {
          platforms: {},
          overall: {
            avg: 0,
            total: 0,
            max: 0,
            min: Number.POSITIVE_INFINITY,
            count: 0,
          },
        }
      }

      if (!processed.metrics[metrictype].platforms[platform]) {
        processed.metrics[metrictype].platforms[platform] = {
          avg: Number.parseFloat(avgvalue),
          total: Number.parseFloat(totalvalue),
          max: Number.parseFloat(maxvalue),
          min: Number.parseFloat(minvalue),
          count: Number.parseInt(datapoints),
        }
      }

      processed.totalDataPoints += Number.parseInt(datapoints)

      processed.timeSeries.push({
        timestamp: timegroup,
        metricType: metrictype,
        platform,
        value: Number.parseFloat(avgvalue),
      })
    })

    return processed
  }

  private async getIndustryAverages(query: DashboardQueryDto) {
    // Implementation for industry benchmark calculations
    return {}
  }

  private async getPeerComparison(query: DashboardQueryDto) {
    // Implementation for peer comparison logic
    return {}
  }

  private async getPercentileRanking(query: DashboardQueryDto) {
    // Implementation for percentile ranking calculations
    return {}
  }
}
