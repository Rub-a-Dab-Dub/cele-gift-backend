export interface DatabaseConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl?: boolean;
    extra?: Record<string, any>;
  }
  
  export interface PoolConfig {
    min: number;
    max: number;
    idle: number;
    acquire: number;
    evict: number;
    handleDisconnects: boolean;
  }
  
  export interface ReadReplicaConfig extends DatabaseConfig {
    weight?: number;
  }
  
  export interface CircuitBreakerConfig {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    rollingCountTimeout: number;
    rollingCountBuckets: number;
    name: string;
    group: string;
  }
  
  export interface DatabaseEnvironmentConfig {
    primary: DatabaseConfig;
    readReplicas?: ReadReplicaConfig[];
    poolConfig: PoolConfig;
    circuitBreaker: CircuitBreakerConfig;
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
      retries: number;
    };
    logging: {
      enabled: boolean;
      level: 'error' | 'warn' | 'info' | 'debug';
      slowQueryThreshold: number;
    };
  }