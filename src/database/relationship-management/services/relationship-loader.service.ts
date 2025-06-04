import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { 
  IRelationshipLoader, 
  SmartLoadingConfig, 
  LoadingStrategy, 
  CircularReferenceConfig 
} from '../interfaces/relationship-management.interface';
import { RelationshipCacheService } from './relationship-cache.service';
import { RelationshipMetadataService } from './relationship-metadata.service';

@Injectable()
export class RelationshipLoaderService implements IRelationshipLoader {
  private readonly logger = new Logger(RelationshipLoaderService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private cacheService: RelationshipCacheService,
    private metadataService: RelationshipMetadataService,
  ) {}

  async loadRelationships<T>(
    entity: T,
    config: SmartLoadingConfig,
    context?: CircularReferenceConfig,
  ): Promise<T> {
    const startTime = Date.now();
    const entityName = (entity as any).constructor.name;
    const entityId = (entity as any).id;

    this.logger.debug(`Loading relationships for ${entityName}:${entityId} with strategy ${config.strategy}`);

    // Initialize circular reference context if not provided
    if (!context) {
      context = {
        maxDepth: config.maxDepth,
        strategy: 'truncate',
        entityMap: new Map(),
      };
    }

    // Check for circular references
    const entityKey = `${entityName}:${entityId}`;
    if (context.entityMap.has(entityKey)) {
      return this.handleCircularReference(entity, context);
    }

    context.entityMap.set(entityKey, entity);

    try {
      switch (config.strategy) {
        case LoadingStrategy.EAGER:
          return await this.loadEager(entity, config, context);
        case LoadingStrategy.LAZY:
          return await this.loadLazy(entity, config, context);
        case LoadingStrategy.SMART:
          return await this.loadSmart(entity, config, context);
        case LoadingStrategy.BATCH:
          return await this.loadBatch([entity], '', config).then(results => results[0]);
        default:
          throw new Error(`Unsupported loading strategy: ${config.strategy}`);
      }
    } finally {
      const executionTime = Date.now() - startTime;
      this.logger.debug(`Relationship loading completed in ${executionTime}ms`);
    }
  }

  async loadBatch<T>(
    entities: T[],
    relationName: string,
    config: SmartLoadingConfig,
  ): Promise<T[]> {
    if (entities.length === 0) return entities;

    const entityName = entities[0].constructor.name;
    const entityIds = entities.map((e: any) => e.id);

    this.logger.debug(`Batch loading ${relationName} for ${entities.length} ${entityName} entities`);

    // Check cache first
    if (config.cacheConfig) {
      const cachedResults = await this.loadFromCache(entityIds, entityName, relationName, config);
      if (cachedResults.length === entities.length) {
        return cachedResults;
      }
    }

    // Load from database
    const repository = this.dataSource.getRepository(entityName);
    const queryBuilder = repository.createQueryBuilder('entity');

    // Add relation joins
    const metadata = this.metadataService.getEntityMetadata(entityName);
    const relationMetadata = metadata.relations.find(r => r.property === relationName);

    if (relationMetadata) {
      queryBuilder.leftJoinAndSelect(`entity.${relationName}`, relationName);
    }

    // Apply conditions and filters
    queryBuilder.whereInIds(entityIds);
    
    if (config.conditions) {
      Object.entries(config.conditions).forEach(([key, value]) => {
        queryBuilder.andWhere(`entity.${key} = :${key}`, { [key]: value });
      });
    }

    if (config.selectFields) {
      queryBuilder.select(config.selectFields.map(field => `entity.${field}`));
    }

    const results = await queryBuilder.getMany();

    // Cache results
    if (config.cacheConfig) {
      await this.cacheResults(results, entityName, relationName, config);
    }

    return results;
  }

  private async loadEager<T>(
    entity: T,
    config: SmartLoadingConfig,
    context: CircularReferenceConfig,
  ): Promise<T> {
    const entityName = (entity as any).constructor.name;
    const repository = this.dataSource.getRepository(entityName);
    
    const queryBuilder = repository.createQueryBuilder('entity');
    const metadata = this.metadataService.getEntityMetadata(entityName);

    // Add all relations up to maxDepth
    this.addRelationJoins(queryBuilder, metadata, 'entity', 0, config.maxDepth);

    queryBuilder.where('entity.id = :id', { id: (entity as any).id });

    return await queryBuilder.getOne() as T;
  }

  private async loadLazy<T>(
    entity: T,
    config: SmartLoadingConfig,
    context: CircularReferenceConfig,
  ): Promise<T> {
    // Return entity as-is for lazy loading
    // Relations will be loaded on-demand through proxies
    return entity;
  }

  private async loadSmart<T>(
    entity: T,
    config: SmartLoadingConfig,
    context: CircularReferenceConfig,
  ): Promise<T> {
    const entityName = (entity as any).constructor.name;
    const entityId = (entity as any).id;

    // Check cache first
    if (config.cacheConfig) {
      const cacheKey = this.cacheService.generateCacheKey(entityName, entityId);
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${entityName}:${entityId}`);
        return cached;
      }
    }

    // Analyze relationship usage patterns to determine optimal loading
    const metadata = this.metadataService.getEntityMetadata(entityName);
    const criticalRelations = this.identifyCriticalRelations(metadata, config);

    const repository = this.dataSource.getRepository(entityName);
    const queryBuilder = repository.createQueryBuilder('entity');

    // Load only critical relations eagerly
    criticalRelations.forEach(relation => {
      queryBuilder.leftJoinAndSelect(`entity.${relation.property}`, relation.property);
    });

    queryBuilder.where('entity.id = :id', { id: entityId });

    const result = await queryBuilder.getOne() as T;

    // Cache the result
    if (config.cacheConfig && result) {
      const cacheKey = this.cacheService.generateCacheKey(entityName, entityId);
      await this.cacheService.set(cacheKey, result, config.cacheConfig.ttl);
    }

    return result;
  }

  private addRelationJoins(
    queryBuilder: SelectQueryBuilder<any>,
    metadata: any,
    alias: string,
    currentDepth: number,
    maxDepth: number,
  ): void {
    if (currentDepth >= maxDepth) return;

    metadata.relations.forEach((relation: any) => {
      const relationAlias = `${alias}_${relation.property}`;
      queryBuilder.leftJoinAndSelect(`${alias}.${relation.property}`, relationAlias);

      // Recursively add nested relations
      if (currentDepth + 1 < maxDepth) {
        const relationMetadata = this.metadataService.getEntityMetadata(relation.targetEntity);
        this.addRelationJoins(queryBuilder, relationMetadata, relationAlias, currentDepth + 1, maxDepth);
      }
    });
  }

  private identifyCriticalRelations(metadata: any, config: SmartLoadingConfig): any[] {
    // Simple heuristic: relations with high usage frequency or small data size
    return metadata.relations.filter((relation: any) => {
      // Load one-to-one and many-to-one relations by default
      return relation.relationType === 'one-to-one' || relation.relationType === 'many-to-one';
    });
  }

  private handleCircularReference<T>(entity: T, context: CircularReferenceConfig): T {
    switch (context.strategy) {
      case 'truncate':
        // Return entity without further relation loading
        return entity;
      case 'proxy':
        // Return a proxy that loads relations on demand
        return this.createLazyProxy(entity);
      case 'exclude':
        // Return null or undefined to exclude from result
        return null as T;
      default:
        return entity;
    }
  }

  private createLazyProxy<T>(entity: T): T {
    return new Proxy(entity, {
      get: (target: any, prop: string) => {
        const value = target[prop];
        
        // If accessing a relation that hasn't been loaded, load it lazily
        if (value === undefined && this.isRelationProperty(target, prop)) {
          return this.loadRelationLazily(target, prop);
        }
        
        return value;
      },
    });
  }

  private isRelationProperty(entity: any, property: string): boolean {
    const metadata = this.metadataService.getEntityMetadata(entity.constructor.name);
    return metadata.relations.some((r: any) => r.property === property);
  }

  private async loadRelationLazily(entity: any, relationName: string): Promise<any> {
    const repository = this.dataSource.getRepository(entity.constructor.name);
    const queryBuilder = repository.createQueryBuilder('entity');
    
    queryBuilder
      .leftJoinAndSelect(`entity.${relationName}`, relationName)
      .where('entity.id = :id', { id: entity.id });

    const result = await queryBuilder.getOne();
    return result?.[relationName];
  }

  private async loadFromCache<T>(
    entityIds: string[],
    entityName: string,
    relationName: string,
    config: SmartLoadingConfig,
  ): Promise<T[]> {
    const promises = entityIds.map(id => {
      const cacheKey = this.cacheService.generateCacheKey(entityName, id, relationName);
      return this.cacheService.get<T>(cacheKey);
    });

    const results = await Promise.all(promises);
    return results.filter(result => result !== null) as T[];
  }

  private async cacheResults<T>(
    results: T[],
    entityName: string,
    relationName: string,
    config: SmartLoadingConfig,
  ): Promise<void> {
    if (!config.cacheConfig) return;

    const promises = results.map(result => {
      const entityId = (result as any).id;
      const cacheKey = this.cacheService.generateCacheKey(entityName, entityId, relationName);
      return this.cacheService.set(cacheKey, result, config.cacheConfig!.ttl);
    });

    await Promise.all(promises);
  }
} 