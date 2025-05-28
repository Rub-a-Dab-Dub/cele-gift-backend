import { registerAs } from '@nestjs/config';
import { DatabaseEnvironmentConfig } from './database-config.interface';

export default registerAs('database', (): Record<string, DatabaseEnvironmentConfig> => {
  const environment = process.env.NODE_ENV || 'development';
  
  const configs: Record<string, DatabaseEnvironmentConfig> = {
    development: {
      primary: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'cele_gift_dev',
        ssl: false,
      },
      poolConfig: {
        min: 2,
        max: 10,
        idle: 30000,
        acquire: 60000,
        evict: 300000,
        handleDisconnects: true,
      },
      circuitBreaker: {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        name: 'DatabaseCircuitBreaker',
        group: 'Database',
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      logging: {
        enabled: true,
        level: 'debug',
        slowQueryThreshold: 1000,
      },
    },
    
    staging: {
      primary: {
        host: process.env.DB_HOST || 'staging-db.example.com',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'app_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cele_gift_staging',
        ssl: true,
        extra: {
          ssl: {
            rejectUnauthorized: false,
          },
        },
      },
      readReplicas: [
        {
          host: process.env.DB_READ_HOST_1 || 'staging-read-1.example.com',
          port: parseInt(process.env.DB_READ_PORT_1 || '5432', 10),
          username: process.env.DB_READ_USERNAME || 'read_user',
          password: process.env.DB_READ_PASSWORD || '',
          database: process.env.DB_NAME || 'cele_gift_staging',
          ssl: true,
          weight: 1,
        },
      ],
      poolConfig: {
        min: 5,
        max: 25,
        idle: 30000,
        acquire: 60000,
        evict: 300000,
        handleDisconnects: true,
      },
      circuitBreaker: {
        timeout: 5000,
        errorThresholdPercentage: 60,
        resetTimeout: 60000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        name: 'DatabaseCircuitBreaker',
        group: 'Database',
      },
      healthCheck: {
        enabled: true,
        interval: 15000,
        timeout: 3000,
        retries: 3,
      },
      logging: {
        enabled: true,
        level: 'info',
        slowQueryThreshold: 500,
      },
    },
    
    production: {
      primary: {
        host: process.env.DB_HOST || 'prod-db.example.com',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'app_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cele_gift_prod',
        ssl: true,
        extra: {
          ssl: {
            rejectUnauthorized: true,
          },
          statement_timeout: 30000,
          query_timeout: 30000,
        },
      },
      readReplicas: [
        {
          host: process.env.DB_READ_HOST_1 || 'prod-read-1.example.com',
          port: parseInt(process.env.DB_READ_PORT_1 || '5432', 10),
          username: process.env.DB_READ_USERNAME || 'read_user',
          password: process.env.DB_READ_PASSWORD || '',
          database: process.env.DB_NAME || 'cele_gift_prod',
          ssl: true,
          weight: 2,
        },
        {
          host: process.env.DB_READ_HOST_2 || 'prod-read-2.example.com',
          port: parseInt(process.env.DB_READ_PORT_2 || '5432', 10),
          username: process.env.DB_READ_USERNAME || 'read_user',
          password: process.env.DB_READ_PASSWORD || '',
          database: process.env.DB_NAME || 'cele_gift_prod',
          ssl: true,
          weight: 1,
        },
      ],
      poolConfig: {
        min: 10,
        max: 50,
        idle: 60000,
        acquire: 30000,
        evict: 180000,
        handleDisconnects: true,
      },
      circuitBreaker: {
        timeout: 10000,
        errorThresholdPercentage: 70,
        resetTimeout: 120000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        name: 'DatabaseCircuitBreaker',
        group: 'Database',
      },
      healthCheck: {
        enabled: true,
        interval: 10000,
        timeout: 2000,
        retries: 5,
      },
      logging: {
        enabled: true,
        level: 'warn',
        slowQueryThreshold: 200,
      },
    },
  };

  return configs[environment] ? { [environment]: configs[environment] } : { development: configs.development };
});
