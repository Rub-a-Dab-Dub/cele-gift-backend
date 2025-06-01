import { TenantIsolationType } from '../enums/tenant-isolation-type.enum';

export interface TenantConfig {
  id: string;
  name: string;
  isolationType: TenantIsolationType;
  databaseConfig?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  schemaName?: string;
  isActive: boolean;
  createdAt: Date;
  settings: Record<string, any>;
}