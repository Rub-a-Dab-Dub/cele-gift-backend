import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Celebrity } from "./entities/celebrity.entity"
import type { DashboardConfig } from "./entities/dashboard-config.entity"
import type { MetricsService } from "../metrics/metrics.service"
import type { TrendingService } from "../trending/trending.service"
import type { CacheService } from "../cache/cache.service"
import type { DashboardQueryDto } from "./dto/dashboard-query.dto"

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name)

  constructor(
    private celebrityRepository: Repository<Celebrity>,
    private dashboardConfigRepository: Repository<DashboardConfig>,
    private metricsService: MetricsService,
    private trendingService: TrendingService,
    private cacheService: CacheService,
  ) {}

  async getDashboardData(query: DashboardQueryDto) {
    const cacheKey = `dashboard:${JSON.stringify(query)}`

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      this.logger.debug("Returning cached dashboard data")
      return cached
    }

    const startTime = Date.now()

    try {
      // Parallel data fetching for better performance
      const [aggregatedMetrics, trendingData, comparisons, topPerformers] = await Promise.all([
        this.metricsService.getAggregatedMetrics(query),
        this.trendingService.getTrendingAnalysis(query),
        query.includeComparisons ? this.getComparativeData(query) : null,
        this.getTopPerformers(query),
      ])

      const dashboardData = {
        timestamp: new Date().toISOString(),
        query,
        metrics: aggregatedMetrics,
        trending: trendingData,
        comparisons,
        topPerformers,
        metadata: {
          processingTime: Date.now() - startTime,
          dataPoints: aggregatedMetrics.totalDataPoints || 0,
        },
      }

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, dashboardData, 300)

      return dashboardData
    } catch (error) {
      this.logger.error("Error generating dashboard data", error)
      throw error
    }
  }

  async getCustomDashboard(configId: string, query: DashboardQueryDto) {
    const config = await this.dashboardConfigRepository.findOne({
      where: { id: configId, isActive: true },
      relations: ["celebrity"],
    })

    if (!config) {
      throw new Error("Dashboard configuration not found")
    }

    // Apply custom filters and widgets
    const customQuery = {
      ...query,
      celebrityId: config.celebrityId,
      ...config.filters,
    }

    const baseData = await this.getDashboardData(customQuery)

    return {
      ...baseData,
      config: {
        layout: config.layout,
        widgets: config.widgets,
        customizations: config.customizations,
      },
    }
  }

  private async getComparativeData(query: DashboardQueryDto) {
    // Get industry averages and peer comparisons
    return this.metricsService.getComparativeMetrics(query)
  }

  private async getTopPerformers(query: DashboardQueryDto) {
    return this.celebrityRepository
      .createQueryBuilder("celebrity")
      .leftJoinAndSelect("celebrity.metrics", "metrics")
      .where("celebrity.isActive = :isActive", { isActive: true })
      .orderBy("metrics.value", "DESC")
      .limit(10)
      .getMany()
  }

  async createDashboardConfig(configData: Partial<DashboardConfig>) {
    const config = this.dashboardConfigRepository.create(configData)
    return this.dashboardConfigRepository.save(config)
  }

  async updateDashboardConfig(id: string, configData: Partial<DashboardConfig>) {
    await this.dashboardConfigRepository.update(id, configData)
    return this.dashboardConfigRepository.findOne({ where: { id } })
  }
}
