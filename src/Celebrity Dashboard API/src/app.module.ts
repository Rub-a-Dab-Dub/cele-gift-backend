import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { RedisModule } from "@nestjs-modules/ioredis"
import { BullModule } from "@nestjs/bull"
import { ScheduleModule } from "@nestjs/schedule"
import { DashboardModule } from "./dashboard/dashboard.module"
import { MetricsModule } from "./metrics/metrics.module"
import { TrendingModule } from "./trending/trending.module"
import { TimeSeriesModule } from "./time-series/time-series.module"
import { CacheModule } from "./cache/cache.module"
import { ExportModule } from "./export/export.module"
import { RealtimeModule } from "./realtime/realtime.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number.parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "celebrity_dashboard",
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== "production",
      logging: process.env.NODE_ENV === "development",
    }),
    RedisModule.forRoot({
      type: "single",
      url: process.env.REDIS_URL || "redis://localhost:6379",
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    ScheduleModule.forRoot(),
    DashboardModule,
    MetricsModule,
    TrendingModule,
    TimeSeriesModule,
    CacheModule,
    ExportModule,
    RealtimeModule,
  ],
})
export class AppModule {}
