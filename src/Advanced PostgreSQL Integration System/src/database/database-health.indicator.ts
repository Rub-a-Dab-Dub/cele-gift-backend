import { Injectable } from "@nestjs/common"
import { HealthIndicator, type HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus"
import type { PostgresMetricsService } from "./postgres-metrics.service"
import type { DatabaseService } from "./database.service"

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    private readonly metricsService: PostgresMetricsService,
    private readonly databaseService: DatabaseService,
  ) {
    super()
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Basic connectivity check
      await this.databaseService.getPostgresVersion()

      // Get detailed health status
      const healthStatus = await this.metricsService.getHealthStatus()

      if (healthStatus.status === "critical") {
        const criticalIssues = healthStatus.checks.filter((check) => check.status === "critical")
        throw new HealthCheckError(
          "Database has critical issues",
          this.getStatus(key, false, {
            status: healthStatus.status,
            issues: criticalIssues.map((issue) => issue.message),
          }),
        )
      }

      return this.getStatus(key, true, {
        status: healthStatus.status,
        checks: healthStatus.checks.map((check) => ({
          name: check.name,
          status: check.status,
          message: check.message,
        })),
      })
    } catch (error) {
      throw new HealthCheckError("Database connection failed", this.getStatus(key, false, { error: error.message }))
    }
  }
}
