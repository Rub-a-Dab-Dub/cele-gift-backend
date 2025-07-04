import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { MetricsService } from "./metrics.service"
import { MetricData } from "./entities/metric-data.entity"

@Module({
  imports: [TypeOrmModule.forFeature([MetricData])],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
