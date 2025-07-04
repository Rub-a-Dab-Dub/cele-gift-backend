import { Module } from "@nestjs/common"
import { RealtimeGateway } from "./realtime.gateway"
import { MetricsModule } from "../metrics/metrics.module"
import { CacheModule } from "../cache/cache.module"

@Module({
  imports: [MetricsModule, CacheModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
