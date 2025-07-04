import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { MetricData } from "../metrics/entities/metric-data.entity"
import type { DashboardQueryDto } from "../dashboard/dto/dashboard-query.dto"

interface TrendingAnalysis {
  metric: string
  platform: string
  trend: "up" | "down" | "stable"
  changePercent: number
  velocity: number
  significance: "high" | "medium" | "low"
  forecast: number[]
}

@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name)

  constructor(private metricDataRepository: Repository<MetricData>) {}

  async getTrendingAnalysis(query: DashboardQueryDto): Promise<TrendingAnalysis[]> {
    const trends = await this.calculateTrends(query)
    const forecasts = await this.generateForecasts(trends)

    return trends.map((trend) => ({
      ...trend,
      forecast: forecasts[`${trend.metric}_${trend.platform}`] || [],
    }))
  }

  private async calculateTrends(query: DashboardQueryDto) {
    const { celebrityId, timeRange, metrics, platforms } = query

    // Get time-series data for trend calculation
    const queryBuilder = this.metricDataRepository
      .createQueryBuilder("metric")
      .select([
        "metric.metricType",
        "metric.platform",
        "metric.value",
        "metric.timestamp",
        "LAG(metric.value) OVER (PARTITION BY metric.metricType, metric.platform ORDER BY metric.timestamp) as previousValue",
      ])
      .where("metric.timestamp >= NOW() - INTERVAL :interval", {
        interval: this.getIntervalString(timeRange),
      })

    if (celebrityId) {
      queryBuilder.andWhere("metric.celebrityId = :celebrityId", { celebrityId })
    }

    if (metrics?.length) {
      queryBuilder.andWhere("metric.metricType IN (:...metrics)", { metrics })
    }

    if (platforms?.length) {
      queryBuilder.andWhere("metric.platform IN (:...platforms)", { platforms })
    }

    const data = await queryBuilder.getRawMany()

    return this.analyzeTrendData(data)
  }

  private analyzeTrendData(data: any[]): TrendingAnalysis[] {
    const trendMap = new Map<string, any[]>()

    // Group data by metric and platform
    data.forEach((row) => {
      const key = `${row.metricType}_${row.platform}`
      if (!trendMap.has(key)) {
        trendMap.set(key, [])
      }
      trendMap.get(key)!.push(row)
    })

    const trends: TrendingAnalysis[] = []

    trendMap.forEach((values, key) => {
      const [metricType, platform] = key.split("_")
      const sortedValues = values.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      if (sortedValues.length < 2) return

      const trend = this.calculateTrendDirection(sortedValues)
      const velocity = this.calculateVelocity(sortedValues)
      const significance = this.calculateSignificance(sortedValues, trend.changePercent)

      trends.push({
        metric: metricType,
        platform,
        trend: trend.direction,
        changePercent: trend.changePercent,
        velocity,
        significance,
        forecast: [], // Will be populated later
      })
    })

    return trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
  }

  private calculateTrendDirection(values: any[]) {
    const firstValue = Number.parseFloat(values[0].value)
    const lastValue = Number.parseFloat(values[values.length - 1].value)
    const changePercent = ((lastValue - firstValue) / firstValue) * 100

    let direction: "up" | "down" | "stable"
    if (Math.abs(changePercent) < 5) {
      direction = "stable"
    } else if (changePercent > 0) {
      direction = "up"
    } else {
      direction = "down"
    }

    return { direction, changePercent }
  }

  private calculateVelocity(values: any[]): number {
    if (values.length < 3) return 0

    const changes = []
    for (let i = 1; i < values.length; i++) {
      const current = Number.parseFloat(values[i].value)
      const previous = Number.parseFloat(values[i - 1].value)
      const timeDiff = new Date(values[i].timestamp).getTime() - new Date(values[i - 1].timestamp).getTime()
      const change = (current - previous) / (timeDiff / (1000 * 60 * 60)) // Change per hour
      changes.push(change)
    }

    // Calculate acceleration (change in velocity)
    let acceleration = 0
    for (let i = 1; i < changes.length; i++) {
      acceleration += Math.abs(changes[i] - changes[i - 1])
    }

    return acceleration / (changes.length - 1)
  }

  private calculateSignificance(values: any[], changePercent: number): "high" | "medium" | "low" {
    const absChange = Math.abs(changePercent)
    const variance = this.calculateVariance(values.map((v) => Number.parseFloat(v.value)))

    if (absChange > 20 && variance > 100) return "high"
    if (absChange > 10 || variance > 50) return "medium"
    return "low"
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  private async generateForecasts(trends: TrendingAnalysis[]): Promise<Record<string, number[]>> {
    const forecasts: Record<string, number[]> = {}

    // Simple linear regression forecast for each trend
    trends.forEach((trend) => {
      const key = `${trend.metric}_${trend.platform}`
      forecasts[key] = this.linearForecast(trend)
    })

    return forecasts
  }

  private linearForecast(trend: TrendingAnalysis): number[] {
    // Generate 7-day forecast based on current trend
    const forecast = []
    const baseValue = 100 // Normalized base value
    const dailyChange = trend.changePercent / 7 // Distribute change over 7 days

    for (let i = 1; i <= 7; i++) {
      const forecastValue = baseValue + dailyChange * i
      forecast.push(Math.max(0, forecastValue)) // Ensure non-negative values
    }

    return forecast
  }

  private getIntervalString(timeRange: string): string {
    const intervals = {
      "1h": "2 hours",
      "1d": "2 days",
      "1w": "2 weeks",
      "1m": "2 months",
      "3m": "6 months",
      "1y": "2 years",
    }
    return intervals[timeRange] || "2 days"
  }
}
