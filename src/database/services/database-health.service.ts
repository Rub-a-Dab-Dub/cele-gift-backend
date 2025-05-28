import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseEnvironmentConfig } from '../config/database-config.interface';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  connections: {
    primary: boolean;
    readReplicas: { [key: string]: boolean };
  };
  metrics: {
    responseTime: number;
    activeConnections: number;
    errors: string[];
  };
}

@Injectable()
export class DatabaseHealthService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private currentHealth: HealthStatus;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private primaryDataSource: DataSource,
    @InjectDataSource('read') private readDataSource: DataSource,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const dbConfig = this.getDatabaseConfig();
    if (dbConfig.healthCheck.enabled) {
      this.startHealthChecks();
    }
  }

  private getDatabaseConfig(): DatabaseEnvironmentConfig {
    const env = process.env.NODE_ENV || 'development';
    return this.configService.get(`database.${env}`);
  }

  private startHealthChecks(): void {
    const config = this.getDatabaseConfig();
    
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      config.healthCheck.interval
    );
    
    // Initial health check
    this.performHealthCheck();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async performHealthCheck(): Promise<HealthStatus> {
    const config = this.getDatabaseConfig();
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Check primary connection
      const primaryHealthy = await this.checkConnection(
        this.primaryDataSource,
        'primary',
        config.healthCheck.timeout
      );

      // Check read replica connections
      const readReplicaHealth: { [key: string]: boolean } = {};
      if (config.readReplicas) {
        for (let i = 0; i < config.readReplicas.length; i++) {
          try {
            readReplicaHealth[`replica_${i}`] = await this.checkConnection(
              this.readDataSource,
              `read_replica_${i}`,
              config.healthCheck.timeout
            );
          } catch (error) {
            readReplicaHealth[`replica_${i}`] = false;
            errors.push(`Read replica ${i}: ${error.message}`);
          }
        }
      }

      const responseTime = Date.now() - startTime;
      const allHealthy = primaryHealthy && Object.values(readReplicaHealth).every(h => h);
      
      this.currentHealth = {
        status: allHealthy ? 'healthy' : (primaryHealthy ? 'degraded' : 'unhealthy'),
        timestamp: new Date(),
        connections: {
          primary: primaryHealthy,
          readReplicas: readReplicaHealth,
        },
        metrics: {
          responseTime,
          activeConnections: this.getActiveConnectionsCount(),
          errors,
        },
      };

      if (!allHealthy) {
        this.logger.warn('Database health check failed', { health: this.currentHealth });
      }

      return this.currentHealth;
    } catch (error) {
      this.logger.error('Health check failed', error.stack);
      
      this.currentHealth = {
        status: 'unhealthy',
        timestamp: new Date(),
        connections: { primary: false, readReplicas: {} },
        metrics: {
          responseTime: Date.now() - startTime,
          activeConnections: 0,
          errors: [error.message],
        },
      };
      
      return this.currentHealth;
    }
  }

  private async checkConnection(
    dataSource: DataSource,
    name: string,
    timeout: number
  ): Promise<boolean> {
    const query = 'SELECT 1 as health_check';
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      
      dataSource.query(query)
        .then(() => {
          clearTimeout(timer);
          resolve(true);
        })
        .catch((error) => {
          clearTimeout(timer);
          this.logger.error(`Health check failed for ${name}`, error.message);
          resolve(false);
        });
    });
  }

  private getActiveConnectionsCount(): number {
    try {
      const pool = (this.primaryDataSource.driver as any).pool;
      return pool?.totalCount || 0;
    } catch {
      return 0;
    }
  }

  getCurrentHealth(): HealthStatus {
    return this.currentHealth;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.currentHealth) {
      await this.performHealthCheck();
    }
    return this.currentHealth.status !== 'unhealthy';
  }
}