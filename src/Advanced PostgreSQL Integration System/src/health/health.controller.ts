import { Controller, Get } from "@nestjs/common"
import { HealthCheck, type HealthCheckService } from "@nestjs/terminus"
import type { DatabaseHealthIndicator } from "../database/database-health.indicator"
import type { PostgresMetricsService } from "../database/postgres-metrics.service"

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
    private readonly metricsService: PostgresMetricsService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.databaseHealthIndicator.isHealthy("database")])
  }

  @Get("metrics")
  getMetrics() {
    return this.metricsService.getMetrics()
  }

  @Get("detailed")
  async getDetailedHealth() {
    const healthStatus = await this.metricsService.getHealthStatus()
    const metrics = this.metricsService.getMetrics()

    return {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      checks: healthStatus.checks,
      metrics,
    }
  }
}
