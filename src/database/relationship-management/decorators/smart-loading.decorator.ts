import 'reflect-metadata';
import { LoadingStrategy, SmartLoadingConfig } from '../interfaces/relationship-management.interface';

// Metadata keys for storing decorator information
export const SMART_LOADING_METADATA_KEY = Symbol('smart-loading');
export const RELATIONSHIP_CONFIG_METADATA_KEY = Symbol('relationship-config');
export const CACHE_CONFIG_METADATA_KEY = Symbol('cache-config');

/**
 * Decorator to configure smart loading strategy for entity relationships
 */
export function SmartLoading(config: Partial<SmartLoadingConfig>) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const defaultConfig: SmartLoadingConfig = {
      strategy: LoadingStrategy.SMART,
      batchSize: 50,
      maxDepth: 3,
      selectFields: undefined,
      cacheConfig: undefined,
      conditions: undefined,
    };

    const finalConfig = { ...defaultConfig, ...config };

    if (propertyKey) {
      // Applied to a property (relationship)
      const existingMetadata = Reflect.getMetadata(SMART_LOADING_METADATA_KEY, target) || {};
      existingMetadata[propertyKey] = finalConfig;
      Reflect.defineMetadata(SMART_LOADING_METADATA_KEY, existingMetadata, target);
    } else {
      // Applied to a class
      Reflect.defineMetadata(SMART_LOADING_METADATA_KEY, finalConfig, target);
    }
  };
}

/**
 * Decorator to configure eager loading for specific relationships
 */
export function EagerLoad(selectFields?: string[], conditions?: Record<string, any>) {
  return SmartLoading({
    strategy: LoadingStrategy.EAGER,
    selectFields,
    conditions,
  });
}

/**
 * Decorator to configure lazy loading for specific relationships
 */
export function LazyLoad() {
  return SmartLoading({
    strategy: LoadingStrategy.LAZY,
  });
}

/**
 * Decorator to configure batch loading for relationships
 */
export function BatchLoad(batchSize: number = 50) {
  return SmartLoading({
    strategy: LoadingStrategy.BATCH,
    batchSize,
  });
}

/**
 * Decorator to configure caching for relationships
 */
export function CacheRelationship(ttl: number = 300, keyPrefix?: string) {
  return function (target: any, propertyKey: string) {
    const cacheConfig = {
      ttl,
      maxSize: 1000,
      keyPrefix: keyPrefix || `rel:${target.constructor.name}:${propertyKey}`,
      compression: true,
      evictionPolicy: 'LRU' as const,
    };

    Reflect.defineMetadata(CACHE_CONFIG_METADATA_KEY, cacheConfig, target, propertyKey);
  };
}

/**
 * Decorator to mark relationships that should avoid circular loading
 */
export function AvoidCircular(maxDepth: number = 2) {
  return SmartLoading({
    maxDepth,
    strategy: LoadingStrategy.SMART,
  });
}

/**
 * Decorator to configure relationship validation rules
 */
export function ValidateRelationship(rules: string[]) {
  return function (target: any, propertyKey: string) {
    const existingRules = Reflect.getMetadata('validation-rules', target, propertyKey) || [];
    const allRules = [...existingRules, ...rules];
    Reflect.defineMetadata('validation-rules', allRules, target, propertyKey);
  };
}

/**
 * Decorator to mark relationships for cascade operations
 */
export function CascadeOperations(operations: string[]) {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata('cascade-operations', operations, target, propertyKey);
  };
}

/**
 * Decorator to optimize queries for specific relationship patterns
 */
export function OptimizeFor(pattern: 'read-heavy' | 'write-heavy' | 'balanced') {
  return function (target: any, propertyKey: string) {
    const optimizationConfig = {
      pattern,
      timestamp: Date.now(),
    };

    Reflect.defineMetadata('optimization-config', optimizationConfig, target, propertyKey);
  };
}

/**
 * Decorator to configure relationship indexing hints
 */
export function IndexHint(indexes: string[]) {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata('index-hints', indexes, target, propertyKey);
  };
}

/**
 * Utility functions to retrieve decorator metadata
 */
export class RelationshipDecoratorUtils {
  static getSmartLoadingConfig(target: any, propertyKey?: string): SmartLoadingConfig | undefined {
    if (propertyKey) {
      const metadata = Reflect.getMetadata(SMART_LOADING_METADATA_KEY, target);
      return metadata?.[propertyKey];
    }
    return Reflect.getMetadata(SMART_LOADING_METADATA_KEY, target);
  }

  static getCacheConfig(target: any, propertyKey: string): any {
    return Reflect.getMetadata(CACHE_CONFIG_METADATA_KEY, target, propertyKey);
  }

  static getValidationRules(target: any, propertyKey: string): string[] {
    return Reflect.getMetadata('validation-rules', target, propertyKey) || [];
  }

  static getCascadeOperations(target: any, propertyKey: string): string[] {
    return Reflect.getMetadata('cascade-operations', target, propertyKey) || [];
  }

  static getOptimizationConfig(target: any, propertyKey: string): any {
    return Reflect.getMetadata('optimization-config', target, propertyKey);
  }

  static getIndexHints(target: any, propertyKey: string): string[] {
    return Reflect.getMetadata('index-hints', target, propertyKey) || [];
  }

  static getAllRelationshipMetadata(target: any): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Get all property names that have relationship metadata
    const smartLoadingMetadata = Reflect.getMetadata(SMART_LOADING_METADATA_KEY, target) || {};
    
    Object.keys(smartLoadingMetadata).forEach(propertyKey => {
      metadata[propertyKey] = {
        smartLoading: smartLoadingMetadata[propertyKey],
        cache: this.getCacheConfig(target, propertyKey),
        validation: this.getValidationRules(target, propertyKey),
        cascade: this.getCascadeOperations(target, propertyKey),
        optimization: this.getOptimizationConfig(target, propertyKey),
        indexHints: this.getIndexHints(target, propertyKey),
      };
    });

    return metadata;
  }
}

/**
 * Method decorator for automatic relationship loading
 */
export function AutoLoadRelationships(config?: Partial<SmartLoadingConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // This would be implemented to automatically load relationships
      // before executing the method
      const result = await originalMethod.apply(this, args);
      
      // Post-process result to load relationships if needed
      return result;
    };

    // Store configuration for the method
    Reflect.defineMetadata('auto-load-config', config, target, propertyKey);
  };
}

/**
 * Class decorator to configure default relationship loading strategy
 */
export function DefaultLoadingStrategy(strategy: LoadingStrategy) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata('default-loading-strategy', strategy, constructor);
    return constructor;
  };
}

/**
 * Property decorator to mark relationships as performance-critical
 */
export function PerformanceCritical(priority: 'high' | 'medium' | 'low' = 'high') {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata('performance-priority', priority, target, propertyKey);
  };
}

/**
 * Decorator to configure relationship monitoring and metrics
 */
export function MonitorRelationship(metricsConfig?: {
  trackQueryCount?: boolean;
  trackExecutionTime?: boolean;
  trackCacheHitRate?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const defaultConfig = {
      trackQueryCount: true,
      trackExecutionTime: true,
      trackCacheHitRate: true,
    };

    const finalConfig = { ...defaultConfig, ...metricsConfig };
    Reflect.defineMetadata('monitoring-config', finalConfig, target, propertyKey);
  };
} 