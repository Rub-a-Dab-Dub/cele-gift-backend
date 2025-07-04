import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseEnvironmentConfig } from '../../config/database/database-config.interface';

@Injectable()
export class ReadReplicaService {
  private readonly logger = new Logger(ReadReplicaService.name);

  constructor(
    @InjectDataSource() private primaryDataSource: DataSource,
    @InjectDataSource('read') private readDataSource: DataSource,
    private configService: ConfigService,
  ) {}

  private getDatabaseConfig(): DatabaseEnvironmentConfig {
    const env = process.env.NODE_ENV || 'development';
    const config = this.configService.get<DatabaseEnvironmentConfig>(
      `database.${env}`,
    );

    if (!config) {
      throw new Error(`Database config for environment "${env}" is missing`);
    }

    return config;
  }

  async getReadDataSource(): Promise<DataSource> {
    const config = this.getDatabaseConfig();
    
    // If no read replicas are configured, return the primary data source
    if (!config.readReplicas || config.readReplicas.length === 0) {
      return this.primaryDataSource;
    }

    // Check if read replica is healthy
    try {
      await this.readDataSource.query('SELECT 1');
      return this.readDataSource;
    } catch (error) {
      this.logger.warn('Read replica is not available, falling back to primary', error);
      return this.primaryDataSource;
    }
  }

  async isReadReplicaAvailable(): Promise<boolean> {
    try {
      await this.readDataSource.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getReadReplicaStatus(): Promise<{
    available: boolean;
    lag: number | null;
    lastSync: Date | null;
  }> {
    const config = this.getDatabaseConfig();
    
    if (!config.readReplicas || config.readReplicas.length === 0) {
      return {
        available: false,
        lag: null,
        lastSync: null,
      };
    }

    try {
      // Check replication lag
      const [lagResult] = await this.readDataSource.query(`
        SELECT 
          CASE 
            WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0
            ELSE EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::integer
          END as lag,
          pg_last_xact_replay_timestamp() as last_sync
      `);

      return {
        available: true,
        lag: lagResult.lag,
        lastSync: lagResult.last_sync,
      };
    } catch (error) {
      this.logger.error('Failed to get read replica status', error);
      return {
        available: false,
        lag: null,
        lastSync: null,
      };
    }
  }
} 