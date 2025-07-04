import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { TrendingService } from "./trending.service"
import { MetricData } from "../metrics/entities/metric-data.entity"

@Module({
  imports: [TypeOrmModule.forFeature([MetricData])],
  providers: [TrendingService],
  exports: [TrendingService],
})
export class TrendingModule {}
