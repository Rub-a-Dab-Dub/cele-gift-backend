import { Injectable } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TenantService } from './tenant.service';
import { TenantConfig } from '../interfaces/tenant-config.interface';
import { TenantIsolationType } from '../enums/tenant-isolation-type.enum';

@Injectable()
export class TenantConnectionManager {
  private connections = new Map<string, DataSource>();
  private baseConfig: DataSourceOptions;
  
  constructor(private tenantService: TenantService) {
    this.baseConfig = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      entities: ['dist/**/*.entity{.ts,.js}'],
      migrations: ['dist/migrations/*{.ts,.js}'],
    };
  }
  
  async getConnection(tenantId: string): Promise<DataSource> {
    if (this.connections.has(tenantId)) {
      return this.connections.get(tenantId);
    }
    
    const tenant = this.tenantService.getTenant(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    
    const connection = await this.createConnection(tenant);
    this.connections.set(tenantId, connection);
    
    return connection;
  }
  
  private async createConnection(tenant: TenantConfig): Promise<DataSource> {
    let config: DataSourceOptions;
    
    switch (tenant.isolationType) {
      case TenantIsolationType.DATABASE:
        config = {
          ...this.baseConfig,
          ...tenant.databaseConfig,
          database: tenant.databaseConfig?.database || `tenant_${tenant.id}`
        };
        break;
        
      case TenantIsolationType.SCHEMA:
        config = {
          ...this.baseConfig,
          schema: tenant.schemaName || `tenant_${tenant.id}`
        };
        break;
        
      case TenantIsolationType.ROW_LEVEL:
        config = { ...this.baseConfig };
        break;
        
      default:
        throw new Error('Invalid tenant isolation type');
    }
    
    const dataSource = new DataSource(config);
    await dataSource.initialize();
    
    return dataSource;
  }
  
  async closeConnection(tenantId: string): Promise<void> {
    const connection = this.connections.get(tenantId);
    if (connection) {
      await connection.destroy();
      this.connections.delete(tenantId);
    }
  }
}