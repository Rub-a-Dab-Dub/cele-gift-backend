import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { MetricData } from "../metrics/entities/metric-data.entity"
import type { CacheService } from "../cache/cache.service"

interface TimeSeriesQuery {
  celebrityId?: string
  metricType: string
  platform?: string
  startTime: Date
  endTime: Date
  interval: "1m" | "5m" | "15m" | "1h" | "1d"
  aggregation: "avg" | "sum" | "max" | "min" | "count"
}

@Injectable()
export class TimeSeriesService {
  private readonly logger = new Logger(TimeSeriesService.name)

  constructor(
    private metricDataRepository: Repository<MetricData>,
    private cacheService: CacheService,
  ) {}

  async getTimeSeriesData(query: TimeSeriesQuery) {
    const cacheKey = `timeseries:${JSON.stringify(query)}`

    // Check cache first
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    const { celebrityId, metricType, platform, startTime, endTime, interval, aggregation } = query

    const queryBuilder = this.metricDataRepository
      .createQueryBuilder("metric")
      .select([
        `DATE_TRUNC('${this.getPostgresInterval(interval)}', metric.timestamp) as time_bucket`,
        `${aggregation.toUpperCase()}(metric.value) as value`,
        "COUNT(*) as data_points",
      ])
      .where("metric.metricType = :metricType", { metricType })
      .andWhere("metric.timestamp BETWEEN :startTime AND :endTime", { startTime, endTime })
      .groupBy("time_bucket")
      .orderBy("time_bucket", "ASC")

    if (celebrityId) {
      queryBuilder.andWhere("metric.celebrityId = :celebrityId", { celebrityId })
    }

    if (platform) {
      queryBuilder.andWhere("metric.platform = :platform", { platform })
    }

    const results = await queryBuilder.getRawMany()

    const processedData = {
      query,
      data: results.map((row) => ({
        timestamp: row.time_bucket,
        value: Number.parseFloat(row.value),
        dataPoints: Number.parseInt(row.data_points),
      })),
      metadata: {
        totalPoints: results.length,
        interval,
        aggregation,
      },
    }

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, processedData, 300)

    return processedData
  }

  async getAnomalyDetection(query: TimeSeriesQuery) {
    const timeSeriesData = await this.getTimeSeriesData(query)
    const values = timeSeriesData.data.map((d) => d.value)

    if (values.length < 10) {
      return { anomalies: [], threshold: null }
    }

    // Simple statistical anomaly detection using z-score
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    const threshold = 2.5 // Z-score threshold

    const anomalies = timeSeriesData.data
      .map((point, index) => ({
        ...point,
        zScore: Math.abs(point.value - mean) / stdDev,
        isAnomaly: Math.abs(point.value - mean) / stdDev > threshold,
      }))
      .filter((point) => point.isAnomaly)

    return {
      anomalies,
      threshold,
      statistics: {
        mean,
        stdDev,
        variance,
        totalPoints: values.length,
      },
    }
  }

  private getPostgresInterval(interval: string): string {
    const intervals = {
      "1m": "minute",
      "5m": "minute",
      "15m": "minute",
      "1h": "hour",
      "1d": "day",
    }
    return intervals[interval] || "hour"
  }
}
