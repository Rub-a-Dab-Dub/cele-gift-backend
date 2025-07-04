import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { TimeSeriesService } from "./time-series.service"
import { MetricData } from "../metrics/entities/metric-data.entity"
import { CacheModule } from "../cache/cache.module"

@Module({
  imports: [TypeOrmModule.forFeature([MetricData]), CacheModule],
  providers: [TimeSeriesService],
  exports: [TimeSeriesService],
})
export class TimeSeriesModule {}
