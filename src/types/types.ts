export interface PostgreSQLConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    schema?: string;
    timezone?: string;
    ssl?: boolean | object;
    extensions?: string[];
    maxConnections?: number;
    connectionTimeout?: number;
  }
  
  export interface NotificationPayload {
    channel: string;
    payload: string;
    processId: number;
  }
  
  export interface PostgreSQLMetrics {
    activeConnections: number;
    totalConnections: number;
    databaseSize: number;
    indexHitRatio: number;
    bufferHitRatio: number;
    deadlocks: number;
    slowQueries: number;
  }
  
  // Custom PostgreSQL column types
  export type PostgreSQLArray<T> = T[];
  export type PostgreSQLJSON = Record<string, any>;
  export type PostgreSQLJSONB = Record<string, any>;
  export type PostgreSQLHStore = Record<string, string>;
  
  // decorators/postgres-column.decorator.ts
  import { Column, ColumnOptions } from 'typeorm';
  
  export function PostgreSQLArrayColumn(type: string, options?: ColumnOptions) {
    return Column({
      type: 'simple-array' as any,
      transformer: {
        to: (value: any[]) => value ? JSON.stringify(value) : null,
        from: (value: string) => value ? JSON.parse(value) : []
      },
      ...options
    });
  }
  
  export function PostgreSQLJSONColumn(options?: ColumnOptions) {
    return Column({
      type: 'json',
      transformer: {
        to: (value: any) => value,
        from: (value: any) => value
      },
      ...options
    });
  }
  
  export function PostgreSQLJSONBColumn(options?: ColumnOptions) {
    return Column({
      type: 'jsonb',
      transformer: {
        to: (value: any) => value,
        from: (value: any) => value
      },
      ...options
    });
  }
  
  export function PostgreSQLHStoreColumn(options?: ColumnOptions) {
    return Column({
      type: 'hstore',
      transformer: {
        to: (value: Record<string, string>) => value,
        from: (value: any) => value || {}
      },
      ...options
    });
  }