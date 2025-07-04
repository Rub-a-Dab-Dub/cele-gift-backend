import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DashboardController } from "./dashboard.controller"
import { DashboardService } from "./dashboard.service"
import { Celebrity } from "./entities/celebrity.entity"
import { DashboardConfig } from "./entities/dashboard-config.entity"
import { MetricsModule } from "../metrics/metrics.module"
import { TrendingModule } from "../trending/trending.module"
import { CacheModule } from "../cache/cache.module"
import { ExportModule } from "../export/export.module"

@Module({
  imports: [
    TypeOrmModule.forFeature([Celebrity, DashboardConfig]),
    MetricsModule,
    TrendingModule,
    CacheModule,
    ExportModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
