import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import databaseConfig from './config/database.config';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { DatabaseHealthService } from './services/database-health.service';
import { DatabaseLoggerService } from './services/database-logger.service';
import { ReadReplicaService } from './services/read-replica.service';
import { DatabaseEnvironmentConfig } from './config/interfaces/database-config.interface';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(databaseConfig),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const env = process.env.NODE_ENV || 'development';
        const dbConfig: DatabaseEnvironmentConfig = configService.get(`database.${env}`);
        
        return {
          type: 'postgres',
          ...dbConfig.primary,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: env === 'development',
          logging: dbConfig.logging.enabled,
          logger: 'advanced-console',
          extra: {
            ...dbConfig.primary.extra,
            max: dbConfig.poolConfig.max,
            min: dbConfig.poolConfig.min,
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
        const dbConfig: DatabaseEnvironmentConfig = configService.get(`database.${env}`);
        
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
        const dbConfig: DatabaseEnvironmentConfig = configService.get(`database.${env}`);
        
        circuitBreakerService.registerBreaker('database', dbConfig.circuitBreaker);
        return circuitBreakerService;
      },
      inject: [CircuitBreakerService, ConfigService],
    },
  ],
  exports: [
    CircuitBreakerService,
    DatabaseHealthService,
    DatabaseLoggerService,
    ReadReplicaService,
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
