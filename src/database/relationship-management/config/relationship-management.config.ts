import { registerAs } from '@nestjs/config';
import { LoadingStrategy } from '../interfaces/relationship-management.interface';

export interface RelationshipManagementConfig {
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    compression: boolean;
    evictionPolicy: 'LRU' | 'LFU' | 'TTL';
    keyPrefix: string;
  };
  loading: {
    defaultStrategy: LoadingStrategy;
    maxDepth: number;
    batchSize: number;
    enableSmartLoading: boolean;
  };
  validation: {
    enabled: boolean;
    validateCircularReferences: boolean;
    enforceOnInsert: boolean;
    enforceOnUpdate: boolean;
    enforceOnDelete: boolean;
  };
  cascade: {
    enabled: boolean;
    maxOperationDepth: number;
    enableTransactionRollback: boolean;
  };
  performance: {
    enableMetrics: boolean;
    slowQueryThreshold: number;
    memoryWarningThreshold: number;
    enableQueryLogging: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      queryCount: number;
      executionTime: number;
      memoryUsage: number;
      cacheHitRate: number;
    };
  };
}

export default registerAs('relationshipManagement', (): RelationshipManagementConfig => ({
  cache: {
    enabled: process.env.RELATIONSHIP_CACHE_ENABLED === 'true' || true,
    ttl: parseInt(process.env.RELATIONSHIP_CACHE_TTL || '300'),
    maxSize: parseInt(process.env.RELATIONSHIP_CACHE_MAX_SIZE || '1000'),
    compression: process.env.RELATIONSHIP_CACHE_COMPRESSION === 'true' || true,
    evictionPolicy: (process.env.RELATIONSHIP_CACHE_EVICTION_POLICY as 'LRU' | 'LFU' | 'TTL') || 'LRU',
    keyPrefix: process.env.RELATIONSHIP_CACHE_KEY_PREFIX || 'rel:',
  },
  loading: {
    defaultStrategy: (process.env.RELATIONSHIP_DEFAULT_STRATEGY as LoadingStrategy) || LoadingStrategy.SMART,
    maxDepth: parseInt(process.env.RELATIONSHIP_MAX_DEPTH || '3'),
    batchSize: parseInt(process.env.RELATIONSHIP_BATCH_SIZE || '50'),
    enableSmartLoading: process.env.RELATIONSHIP_SMART_LOADING === 'true' || true,
  },
  validation: {
    enabled: process.env.RELATIONSHIP_VALIDATION_ENABLED === 'true' || true,
    validateCircularReferences: process.env.RELATIONSHIP_VALIDATE_CIRCULAR === 'true' || true,
    enforceOnInsert: process.env.RELATIONSHIP_ENFORCE_INSERT === 'true' || true,
    enforceOnUpdate: process.env.RELATIONSHIP_ENFORCE_UPDATE === 'true' || true,
    enforceOnDelete: process.env.RELATIONSHIP_ENFORCE_DELETE === 'true' || true,
  },
  cascade: {
    enabled: process.env.RELATIONSHIP_CASCADE_ENABLED === 'true' || true,
    maxOperationDepth: parseInt(process.env.RELATIONSHIP_CASCADE_MAX_DEPTH || '5'),
    enableTransactionRollback: process.env.RELATIONSHIP_CASCADE_ROLLBACK === 'true' || true,
  },
  performance: {
    enableMetrics: process.env.RELATIONSHIP_METRICS_ENABLED === 'true' || true,
    slowQueryThreshold: parseInt(process.env.RELATIONSHIP_SLOW_QUERY_THRESHOLD || '100'),
    memoryWarningThreshold: parseInt(process.env.RELATIONSHIP_MEMORY_WARNING || '52428800'), // 50MB
    enableQueryLogging: process.env.RELATIONSHIP_QUERY_LOGGING === 'true' || false,
  },
  monitoring: {
    enabled: process.env.RELATIONSHIP_MONITORING_ENABLED === 'true' || true,
    metricsInterval: parseInt(process.env.RELATIONSHIP_METRICS_INTERVAL || '60000'), // 1 minute
    alertThresholds: {
      queryCount: parseInt(process.env.RELATIONSHIP_ALERT_QUERY_COUNT || '100'),
      executionTime: parseInt(process.env.RELATIONSHIP_ALERT_EXECUTION_TIME || '1000'),
      memoryUsage: parseInt(process.env.RELATIONSHIP_ALERT_MEMORY_USAGE || '104857600'), // 100MB
      cacheHitRate: parseFloat(process.env.RELATIONSHIP_ALERT_CACHE_HIT_RATE || '0.5'),
    },
  },
})); 