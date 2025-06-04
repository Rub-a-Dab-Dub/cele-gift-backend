import { QueryRunner, EntityTarget, ObjectLiteral } from 'typeorm';

export enum LoadingStrategy {
  EAGER = 'eager',
  LAZY = 'lazy',
  SMART = 'smart',
  BATCH = 'batch',
}

export enum CascadeOperation {
  INSERT = 'insert',
  UPDATE = 'update',
  REMOVE = 'remove',
  SOFT_REMOVE = 'soft-remove',
  RECOVER = 'recover',
}

export interface RelationshipCacheConfig {
  ttl: number;
  maxSize: number;
  keyPrefix: string;
  compression: boolean;
  evictionPolicy: 'LRU' | 'LFU' | 'TTL';
}

export interface SmartLoadingConfig {
  strategy: LoadingStrategy;
  batchSize: number;
  maxDepth: number;
  selectFields?: string[];
  cacheConfig?: RelationshipCacheConfig;
  conditions?: Record<string, any>;
}

export interface RelationshipMetadata {
  entity: string;
  property: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  targetEntity: string;
  isOwner: boolean;
  cascadeOperations: CascadeOperation[];
  loadingStrategy: LoadingStrategy;
  circularReferenceDepth?: number;
}

export interface CircularReferenceConfig {
  maxDepth: number;
  strategy: 'truncate' | 'proxy' | 'exclude';
  entityMap: Map<string, any>;
}

export interface ValidationRule {
  name: string;
  condition: (entity: any, related: any) => boolean;
  message: string;
  severity: 'error' | 'warning';
}

export interface RelationshipIntegrityConfig {
  rules: ValidationRule[];
  enforceOnInsert: boolean;
  enforceOnUpdate: boolean;
  enforceOnDelete: boolean;
  validateCircularReferences: boolean;
}

export interface TransactionContext {
  queryRunner: QueryRunner;
  operations: Array<{
    type: CascadeOperation;
    entity: string;
    id: string;
    data?: any;
    dependencies: string[];
  }>;
  rollbackHandlers: Array<() => Promise<void>>;
}

export interface PerformanceMetrics {
  queryCount: number;
  executionTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  entityCount: number;
  relationshipDepth: number;
}

export interface IRelationshipLoader {
  loadRelationships<T>(
    entity: T,
    config: SmartLoadingConfig,
    context?: CircularReferenceConfig,
  ): Promise<T>;
  
  loadBatch<T>(
    entities: T[],
    relationName: string,
    config: SmartLoadingConfig,
  ): Promise<T[]>;
}

export interface IRelationshipCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
  getMetrics(): Promise<{ hits: number; misses: number; size: number }>;
}

export interface IRelationshipValidator {
  validate<T>(
    entity: T,
    config: RelationshipIntegrityConfig,
  ): Promise<ValidationResult[]>;
  
  validateCircularReferences<T>(
    entity: T,
    visited: Set<string>,
    depth: number,
  ): Promise<boolean>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    rule: string;
    message: string;
    severity: 'error' | 'warning';
    path: string;
  }>;
}

export interface ICascadeManager {
  executeOperation(
    operation: CascadeOperation,
    entity: any,
    context: TransactionContext,
  ): Promise<void>;
  
  buildOperationGraph(
    rootEntity: any,
    operation: CascadeOperation,
  ): Promise<Array<{ entity: any; operation: CascadeOperation; order: number }>>;
} 