import { Module, Global } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { DatabaseService } from "./database.service"
import { PostgresNotificationService } from "./postgres-notification.service"
import { ExtensionManagerService } from "./extension-manager.service"
import { PostgresMetricsService } from "./postgres-metrics.service"
import { DatabaseHealthIndicator } from "./database-health.indicator"
import { TerminusModule } from "@nestjs/terminus"

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST", "localhost"),
        port: configService.get("DB_PORT", 5432),
        username: configService.get("DB_USERNAME", "postgres"),
        password: configService.get("DB_PASSWORD", "password"),
        database: configService.get("DB_NAME", "nestjs_app"),
        entities: [__dirname + "/../**/*.entity{.ts,.js}"],
        synchronize: configService.get("NODE_ENV") !== "production",
        logging: configService.get("DB_LOGGING", false),
        timezone: "UTC",
        extra: {
          timezone: "UTC",
          application_name: "nestjs-app",
          statement_timeout: 30000,
          query_timeout: 30000,
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          max: 20,
        },
        // Enable PostgreSQL-specific features
        cache: {
          type: "database",
          tableName: "query_result_cache",
        },
      }),
      inject: [ConfigService],
    }),
    TerminusModule,
  ],
  providers: [
    DatabaseService,
    PostgresNotificationService,
    ExtensionManagerService,
    PostgresMetricsService,
    DatabaseHealthIndicator,
  ],
  exports: [
    DatabaseService,
    PostgresNotificationService,
    ExtensionManagerService,
    PostgresMetricsService,
    DatabaseHealthIndicator,
  ],
})
export class DatabaseModule {}
