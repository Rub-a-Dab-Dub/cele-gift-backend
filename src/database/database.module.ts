import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import databaseConfig from '../config/database/database.config';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { DatabaseHealthService } from './services/database-health.service';
import { DatabaseLoggerService } from './services/database-logger.service';
import { ReadReplicaService } from '../database/services/read-replica.service';
import { DatabaseEnvironmentConfig } from '../config/database/database-config.interface';
import { RelationshipManagementModule } from './relationship-management/relationship-management.module';
import { MigrationTestingService } from './migration-testing/migration.testing.service';
import { SchemaComparisonService } from './schema-validation/schema.comparison.service';
import { ZeroDowntimeDeploymentService } from './deployment/zero-downtime.deployment.service';
import { PerformanceRegressionService } from './performance/performance.regression.service';
import { DeploymentMonitoringService } from './monitoring/deployment.monitoring.service';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(databaseConfig),
    ScheduleModule.forRoot(),
    RelationshipManagementModule.forRoot(),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const env = process.env.NODE_ENV || 'development';
        const dbConfig = configService.get<DatabaseEnvironmentConfig>(
          `database.${env}`,
        );

        if (!dbConfig) {
          throw new Error(
            `Database config for environment "${env}" not found.`,
          );
        }

        const readConfig = dbConfig.readReplicas?.[0] || dbConfig.primary;

        return {
          type: 'postgres',
          ...readConfig,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: dbConfig.logging.enabled,
          logger: 'advanced-console',
          extra: {
            ...readConfig.extra,
            max: Math.floor(dbConfig.poolConfig.max * 0.7),
            min: Math.floor(dbConfig.poolConfig.min * 0.5),
            idleTimeoutMillis: dbConfig.poolConfig.idle,
            acquireTimeoutMillis: dbConfig.poolConfig.acquire,
            evictionRunIntervalMillis: dbConfig.poolConfig.evict,
          },
        };
      },

      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      name: 'read',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const env = process.env.NODE_ENV || 'development';
        const dbConfig = configService.get<DatabaseEnvironmentConfig>(
          `database.${env}`,
        );

        if (!dbConfig) {
          throw new Error(
            `Database config for environment "${env}" not found.`,
          );
        }

        // Use first read replica or fallback to primary
        const readConfig = dbConfig.readReplicas?.[0] || dbConfig.primary;

        return {
          type: 'postgres',
          ...readConfig,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: dbConfig.logging.enabled,
          logger: 'advanced-console',
          extra: {
            ...readConfig.extra,
            max: Math.floor(dbConfig.poolConfig.max * 0.7), // Smaller pool for reads
            min: Math.floor(dbConfig.poolConfig.min * 0.5),
            idleTimeoutMillis: dbConfig.poolConfig.idle,
            acquireTimeoutMillis: dbConfig.poolConfig.acquire,
            evictionRunIntervalMillis: dbConfig.poolConfig.evict,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    CircuitBreakerService,
    DatabaseHealthService,
    DatabaseLoggerService,
    ReadReplicaService,
    {
      provide: 'CIRCUIT_BREAKER_INIT',
      useFactory: (
        circuitBreakerService: CircuitBreakerService,
        configService: ConfigService,
      ) => {
        const env = process.env.NODE_ENV || 'development';
        const dbConfig = configService.get<DatabaseEnvironmentConfig>(
          `database.${env}`,
        );

        if (!dbConfig) {
          throw new Error(
            `Database config for environment "${env}" not found.`,
          );
        }

        circuitBreakerService.registerBreaker(
          'database',
          dbConfig.circuitBreaker,
        );
        return circuitBreakerService;
      },
      inject: [CircuitBreakerService, ConfigService],
    },
    MigrationTestingService,
    SchemaComparisonService,
    ZeroDowntimeDeploymentService,
    PerformanceRegressionService,
    DeploymentMonitoringService,
  ],
  exports: [
    CircuitBreakerService,
    DatabaseHealthService,
    DatabaseLoggerService,
    ReadReplicaService,
    TypeOrmModule,
    RelationshipManagementModule,
    MigrationTestingService,
    SchemaComparisonService,
    ZeroDowntimeDeploymentService,
    PerformanceRegressionService,
    DeploymentMonitoringService,
  ],
})
export class DatabaseModule {}
