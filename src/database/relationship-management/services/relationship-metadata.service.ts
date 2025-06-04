import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityMetadata } from 'typeorm';
import { RelationshipMetadata } from '../interfaces/relationship-management.interface';

@Injectable()
export class RelationshipMetadataService {
  private readonly logger = new Logger(RelationshipMetadataService.name);
  private metadataCache = new Map<string, any>();

  constructor(@InjectDataSource() private dataSource: DataSource) {
    this.initializeMetadataCache();
  }

  private initializeMetadataCache(): void {
    const entityMetadatas = this.dataSource.entityMetadatas;
    
    entityMetadatas.forEach(metadata => {
      const entityName = metadata.name;
      const relationshipData = {
        entity: entityName,
        relations: metadata.relations.map(relation => ({
          property: relation.propertyName,
          relationType: relation.relationType,
          targetEntity: relation.inverseEntityMetadata.name,
          isOwner: relation.isOwning,
          cascadeOperations: relation.options.cascade || [],
          loadingStrategy: relation.isEager ? 'eager' : 'lazy',
          circularReferenceDepth: this.calculateCircularDepth(metadata, relation),
        })),
        indexes: metadata.indices.map(index => ({
          name: index.name,
          columns: index.columns.map(col => col.propertyName),
          isUnique: index.isUnique,
        })),
        primaryColumns: metadata.primaryColumns.map(col => col.propertyName),
      };

      this.metadataCache.set(entityName, relationshipData);
    });

    this.logger.log(`Initialized metadata cache for ${entityMetadatas.length} entities`);
  }

  getEntityMetadata(entityName: string): any {
    const metadata = this.metadataCache.get(entityName);
    if (!metadata) {
      throw new Error(`Entity metadata not found for: ${entityName}`);
    }
    return metadata;
  }

  getAllEntityMetadata(): Map<string, any> {
    return new Map(this.metadataCache);
  }

  getRelationshipMetadata(entityName: string, relationName: string): RelationshipMetadata | null {
    const entityMetadata = this.getEntityMetadata(entityName);
    const relation = entityMetadata.relations.find((r: any) => r.property === relationName);
    
    if (!relation) {
      return null;
    }

    return {
      entity: entityName,
      property: relationName,
      relationType: relation.relationType,
      targetEntity: relation.targetEntity,
      isOwner: relation.isOwner,
      cascadeOperations: relation.cascadeOperations,
      loadingStrategy: relation.loadingStrategy,
      circularReferenceDepth: relation.circularReferenceDepth,
    };
  }

  getCircularRelationships(entityName: string): RelationshipMetadata[] {
    const metadata = this.getEntityMetadata(entityName);
    return metadata.relations.filter((relation: any) => 
      this.hasCircularReference(entityName, relation.targetEntity)
    );
  }

  private hasCircularReference(sourceEntity: string, targetEntity: string, visited = new Set<string>()): boolean {
    if (visited.has(sourceEntity)) {
      return sourceEntity === targetEntity;
    }

    visited.add(sourceEntity);

    const metadata = this.metadataCache.get(sourceEntity);
    if (!metadata) return false;

    for (const relation of metadata.relations) {
      if (relation.targetEntity === targetEntity) {
        return true;
      }
      
      if (this.hasCircularReference(relation.targetEntity, targetEntity, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  private calculateCircularDepth(metadata: EntityMetadata, relation: any): number {
    // Simple heuristic: if target entity has relation back to source, depth is 1
    const targetMetadata = this.dataSource.getMetadata(relation.inverseEntityMetadata.target);
    const backRelation = targetMetadata.relations.find(r => 
      r.inverseEntityMetadata.name === metadata.name
    );
    
    return backRelation ? 1 : 0;
  }

  getOptimalLoadingStrategy(entityName: string, relationName: string): string {
    const relation = this.getRelationshipMetadata(entityName, relationName);
    if (!relation) return 'lazy';

    // Heuristics for optimal loading strategy
    if (relation.relationType === 'one-to-one' || relation.relationType === 'many-to-one') {
      return 'eager'; // Small, frequently accessed relations
    }

    if (relation.circularReferenceDepth && relation.circularReferenceDepth > 0) {
      return 'lazy'; // Avoid circular loading issues
    }

    return 'smart'; // Use smart loading for complex cases
  }

  getRelationshipComplexity(entityName: string): number {
    const metadata = this.getEntityMetadata(entityName);
    let complexity = 0;

    metadata.relations.forEach((relation: any) => {
      // Base complexity
      complexity += 1;

      // Add complexity for circular references
      if (relation.circularReferenceDepth > 0) {
        complexity += relation.circularReferenceDepth * 2;
      }

      // Add complexity for one-to-many and many-to-many relations
      if (relation.relationType === 'one-to-many' || relation.relationType === 'many-to-many') {
        complexity += 3;
      }
    });

    return complexity;
  }

  getEntityDependencyGraph(): Map<string, string[]> {
    const dependencyGraph = new Map<string, string[]>();

    this.metadataCache.forEach((metadata, entityName) => {
      const dependencies = metadata.relations.map((relation: any) => relation.targetEntity);
      dependencyGraph.set(entityName, dependencies);
    });

    return dependencyGraph;
  }

  findOptimalBatchSize(entityName: string, relationName: string): number {
    const relation = this.getRelationshipMetadata(entityName, relationName);
    if (!relation) return 50; // Default batch size

    // Adjust batch size based on relation type and complexity
    switch (relation.relationType) {
      case 'one-to-one':
      case 'many-to-one':
        return 100; // Smaller relations, larger batches
      case 'one-to-many':
        return 25; // Medium relations
      case 'many-to-many':
        return 10; // Complex relations, smaller batches
      default:
        return 50;
    }
  }

  analyzeQueryPatterns(entityName: string): {
    frequentlyAccessedRelations: string[];
    heavyRelations: string[];
    circularRelations: string[];
  } {
    const metadata = this.getEntityMetadata(entityName);
    
    return {
      frequentlyAccessedRelations: metadata.relations
        .filter((r: any) => r.relationType === 'many-to-one' || r.relationType === 'one-to-one')
        .map((r: any) => r.property),
      
      heavyRelations: metadata.relations
        .filter((r: any) => r.relationType === 'one-to-many' || r.relationType === 'many-to-many')
        .map((r: any) => r.property),
      
      circularRelations: metadata.relations
        .filter((r: any) => r.circularReferenceDepth > 0)
        .map((r: any) => r.property),
    };
  }

  refreshMetadataCache(): void {
    this.metadataCache.clear();
    this.initializeMetadataCache();
    this.logger.log('Metadata cache refreshed');
  }
} 