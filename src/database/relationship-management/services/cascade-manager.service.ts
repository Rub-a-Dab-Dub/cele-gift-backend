import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { 
  ICascadeManager, 
  CascadeOperation, 
  TransactionContext 
} from '../interfaces/relationship-management.interface';
import { RelationshipMetadataService } from './relationship-metadata.service';

@Injectable()
export class CascadeManagerService implements ICascadeManager {
  private readonly logger = new Logger(CascadeManagerService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private metadataService: RelationshipMetadataService,
  ) {}

  async executeOperation(
    operation: CascadeOperation,
    entity: any,
    context: TransactionContext,
  ): Promise<void> {
    const entityName = entity.constructor.name;
    const entityId = entity.id;

    this.logger.debug(`Executing ${operation} operation for ${entityName}:${entityId}`);

    try {
      // Build operation graph to determine execution order
      const operationGraph = await this.buildOperationGraph(entity, operation);
      
      // Sort operations by dependency order
      const sortedOperations = this.topologicalSort(operationGraph);

      // Execute operations in order
      for (const opNode of sortedOperations) {
        await this.executeEntityOperation(opNode.entity, opNode.operation, context);
      }

    } catch (error) {
      this.logger.error(`Error executing cascade operation ${operation}:`, error);
      
      // Execute rollback handlers
      await this.executeRollbackHandlers(context);
      throw error;
    }
  }

  async buildOperationGraph(
    rootEntity: any,
    operation: CascadeOperation,
  ): Promise<Array<{ entity: any; operation: CascadeOperation; order: number }>> {
    const operationGraph: Array<{ entity: any; operation: CascadeOperation; order: number }> = [];
    const visited = new Set<string>();
    
    await this.buildOperationGraphRecursive(
      rootEntity, 
      operation, 
      operationGraph, 
      visited, 
      0
    );

    return operationGraph;
  }

  private async buildOperationGraphRecursive(
    entity: any,
    operation: CascadeOperation,
    graph: Array<{ entity: any; operation: CascadeOperation; order: number }>,
    visited: Set<string>,
    depth: number,
  ): Promise<void> {
    const entityName = entity.constructor.name;
    const entityId = entity.id;
    const entityKey = `${entityName}:${entityId}`;

    // Avoid infinite recursion
    if (visited.has(entityKey)) {
      return;
    }
    visited.add(entityKey);

    try {
      const metadata = this.metadataService.getEntityMetadata(entityName);

      // Process relationships that support the current cascade operation
      for (const relation of metadata.relations) {
        if (this.shouldCascadeOperation(relation, operation)) {
          const relationValue = entity[relation.property];

          if (relationValue) {
            if (Array.isArray(relationValue)) {
              // Handle one-to-many and many-to-many relations
              for (const relatedEntity of relationValue) {
                if (relatedEntity && relatedEntity.id) {
                  await this.buildOperationGraphRecursive(
                    relatedEntity,
                    operation,
                    graph,
                    visited,
                    depth + 1
                  );
                }
              }
            } else {
              // Handle one-to-one and many-to-one relations
              if (relationValue.id) {
                await this.buildOperationGraphRecursive(
                  relationValue,
                  operation,
                  graph,
                  visited,
                  depth + 1
                );
              }
            }
          }
        }
      }

      // Add current entity to graph
      graph.push({
        entity,
        operation,
        order: this.calculateOperationOrder(operation, depth),
      });

    } catch (error) {
      this.logger.error(`Error building operation graph for ${entityKey}:`, error);
      throw error;
    }
  }

  private shouldCascadeOperation(relation: any, operation: CascadeOperation): boolean {
    if (!relation.cascadeOperations || relation.cascadeOperations.length === 0) {
      return false;
    }

    return relation.cascadeOperations.includes(operation) || 
           relation.cascadeOperations.includes('all');
  }

  private calculateOperationOrder(operation: CascadeOperation, depth: number): number {
    // Different operations have different ordering requirements
    switch (operation) {
      case CascadeOperation.INSERT:
        return depth; // Insert parents first, then children
      case CascadeOperation.UPDATE:
        return depth; // Update can be done in any order
      case CascadeOperation.REMOVE:
      case CascadeOperation.SOFT_REMOVE:
        return -depth; // Remove children first, then parents
      case CascadeOperation.RECOVER:
        return depth; // Recover parents first, then children
      default:
        return depth;
    }
  }

  private topologicalSort(
    operations: Array<{ entity: any; operation: CascadeOperation; order: number }>
  ): Array<{ entity: any; operation: CascadeOperation; order: number }> {
    return operations.sort((a, b) => {
      // Primary sort by order
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      // Secondary sort by entity type (for consistency)
      const aType = a.entity.constructor.name;
      const bType = b.entity.constructor.name;
      return aType.localeCompare(bType);
    });
  }

  private async executeEntityOperation(
    entity: any,
    operation: CascadeOperation,
    context: TransactionContext,
  ): Promise<void> {
    const entityName = entity.constructor.name;
    const entityId = entity.id;

    try {
      const repository = this.dataSource.getRepository(entityName);

      switch (operation) {
        case CascadeOperation.INSERT:
          await this.executeInsert(repository, entity, context);
          break;
        case CascadeOperation.UPDATE:
          await this.executeUpdate(repository, entity, context);
          break;
        case CascadeOperation.REMOVE:
          await this.executeRemove(repository, entity, context);
          break;
        case CascadeOperation.SOFT_REMOVE:
          await this.executeSoftRemove(repository, entity, context);
          break;
        case CascadeOperation.RECOVER:
          await this.executeRecover(repository, entity, context);
          break;
        default:
          throw new Error(`Unsupported cascade operation: ${operation}`);
      }

      // Add operation to context for tracking
      context.operations.push({
        type: operation,
        entity: entityName,
        id: entityId,
        data: entity,
        dependencies: this.extractDependencies(entity),
      });

    } catch (error) {
      this.logger.error(`Error executing ${operation} for ${entityName}:${entityId}:`, error);
      throw error;
    }
  }

  private async executeInsert(repository: any, entity: any, context: TransactionContext): Promise<void> {
    const result = await context.queryRunner.manager.save(repository.target, entity);
    
    // Add rollback handler
    context.rollbackHandlers.push(async () => {
      if (result.id) {
        await context.queryRunner.manager.delete(repository.target, result.id);
      }
    });
  }

  private async executeUpdate(repository: any, entity: any, context: TransactionContext): Promise<void> {
    // Get original entity for rollback
    const original = await context.queryRunner.manager.findOne(repository.target, {
      where: { id: entity.id }
    });

    await context.queryRunner.manager.save(repository.target, entity);

    // Add rollback handler
    if (original) {
      context.rollbackHandlers.push(async () => {
        await context.queryRunner.manager.save(repository.target, original);
      });
    }
  }

  private async executeRemove(repository: any, entity: any, context: TransactionContext): Promise<void> {
    // Store entity for potential rollback
    const entityCopy = { ...entity };

    await context.queryRunner.manager.delete(repository.target, entity.id);

    // Add rollback handler
    context.rollbackHandlers.push(async () => {
      await context.queryRunner.manager.save(repository.target, entityCopy);
    });
  }

  private async executeSoftRemove(repository: any, entity: any, context: TransactionContext): Promise<void> {
    // Assuming soft delete uses a deletedAt field
    const original = await context.queryRunner.manager.findOne(repository.target, {
      where: { id: entity.id }
    });

    await context.queryRunner.manager.softDelete(repository.target, entity.id);

    // Add rollback handler
    if (original) {
      context.rollbackHandlers.push(async () => {
        await context.queryRunner.manager.restore(repository.target, entity.id);
      });
    }
  }

  private async executeRecover(repository: any, entity: any, context: TransactionContext): Promise<void> {
    await context.queryRunner.manager.restore(repository.target, entity.id);

    // Add rollback handler
    context.rollbackHandlers.push(async () => {
      await context.queryRunner.manager.softDelete(repository.target, entity.id);
    });
  }

  private extractDependencies(entity: any): string[] {
    const dependencies: string[] = [];
    const entityName = entity.constructor.name;

    try {
      const metadata = this.metadataService.getEntityMetadata(entityName);

      metadata.relations.forEach((relation: any) => {
        const relationValue = entity[relation.property];
        
        if (relationValue) {
          if (Array.isArray(relationValue)) {
            relationValue.forEach(relatedEntity => {
              if (relatedEntity && relatedEntity.id) {
                dependencies.push(`${relatedEntity.constructor.name}:${relatedEntity.id}`);
              }
            });
          } else if (relationValue.id) {
            dependencies.push(`${relationValue.constructor.name}:${relationValue.id}`);
          }
        }
      });
    } catch (error) {
      this.logger.error(`Error extracting dependencies for ${entityName}:`, error);
    }

    return dependencies;
  }

  private async executeRollbackHandlers(context: TransactionContext): Promise<void> {
    this.logger.warn('Executing rollback handlers...');

    // Execute rollback handlers in reverse order
    const handlers = [...context.rollbackHandlers].reverse();

    for (const handler of handlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error('Error executing rollback handler:', error);
        // Continue with other rollback handlers even if one fails
      }
    }

    context.rollbackHandlers.length = 0; // Clear handlers
  }

  // Utility method to create transaction context
  async createTransactionContext(): Promise<TransactionContext> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    return {
      queryRunner,
      operations: [],
      rollbackHandlers: [],
    };
  }

  // Utility method to commit transaction
  async commitTransaction(context: TransactionContext): Promise<void> {
    try {
      await context.queryRunner.commitTransaction();
      this.logger.debug(`Transaction committed with ${context.operations.length} operations`);
    } finally {
      await context.queryRunner.release();
    }
  }

  // Utility method to rollback transaction
  async rollbackTransaction(context: TransactionContext): Promise<void> {
    try {
      await context.queryRunner.rollbackTransaction();
      await this.executeRollbackHandlers(context);
      this.logger.debug('Transaction rolled back');
    } finally {
      await context.queryRunner.release();
    }
  }

  // Method to execute cascade operation with automatic transaction management
  async executeCascadeOperation(
    operation: CascadeOperation,
    entity: any,
  ): Promise<void> {
    const context = await this.createTransactionContext();

    try {
      await this.executeOperation(operation, entity, context);
      await this.commitTransaction(context);
    } catch (error) {
      await this.rollbackTransaction(context);
      throw error;
    }
  }
} 