import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ILifecycleEntity } from '../interfaces/lifecycle-entity.interface';
import { LifecycleManagerService, LifecycleOptions } from '../services/lifecycle-manager.service';

export interface BatchOperation<T> {
  type: 'create' | 'update' | 'delete' | 'archive' | 'restore';
  data: T | Partial<T>;
  id?: string;
}

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);
  private readonly BATCH_SIZE = 100;

  constructor(private lifecycleManager: LifecycleManagerService) {}

  async processBatch<T extends ILifecycleEntity>(
    repository: Repository<T>,
    operations: BatchOperation<T>[],
    options: LifecycleOptions = {}
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = [];
    const errors: Error[] = [];

    // Process operations in batches to avoid memory issues
    for (let i = 0; i < operations.length; i += this.BATCH_SIZE) {
      const batch = operations.slice(i, i + this.BATCH_SIZE);
      
      try {
        const batchResults = await this.processSingleBatch(repository, batch, options);
        results.push(...batchResults.results);
        errors.push(...batchResults.errors);
      } catch (error) {
        this.logger.error(`Batch processing failed for batch ${i / this.BATCH_SIZE + 1}:`, error);
        errors.push(error);
      }
    }

    return { results, errors };
  }

  private async processSingleBatch<T extends ILifecycleEntity>(
    repository: Repository<T>,
    operations: BatchOperation<T>[],
    options: LifecycleOptions
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = [];
    const errors: Error[] = [];

    // Group operations by type for better performance
    const grouped = this.groupOperationsByType(operations);

    // Process creates
    if (grouped.create.length > 0) {
      try {
        const createResults = await this.lifecycleManager.bulkCreate(
          repository,
          grouped.create.map(op => op.data as Partial<T>),
          options
        );
        results.push(...createResults);
      } catch (error) {
        errors.push(error);
      }
    }

    // Process updates (sequential due to complexity)
    for (const operation of grouped.update) {
      try {
        const updateResult = await this.lifecycleManager.update(
          repository,
          operation.id!,
          operation.data as Partial<T>,
          options
        );
        results.push(updateResult);
      } catch (error) {
        errors.push(error);
      }
    }

    // Process deletes
    if (grouped.delete.length > 0) {
      try {
        const deleteResults = await this.lifecycleManager.bulkSoftDelete(
          repository,
          grouped.delete.map(op => op.id!),
          options
        );
        results.push(...deleteResults);
      } catch (error) {
        errors.push(error);
      }
    }

    // Process archives and restores (sequential)
    for (const operation of [...grouped.archive, ...grouped.restore]) {
      try {
        let result: T;
        if (operation.type === 'archive') {
          result = await this.lifecycleManager.archive(repository, operation.id!, options);
        } else {
          result = await this.lifecycleManager.restore(repository, operation.id!, options);
        }
        results.push(result);
      } catch (error) {
        errors.push(error);
      }
    }

    return { results, errors };
  }

  private groupOperationsByType<T>(operations: BatchOperation<T>[]) {
    return operations.reduce((acc, op) => {
      acc[op.type].push(op);
      return acc;
    }, {
      create: [] as BatchOperation<T>[],
      update: [] as BatchOperation<T>[],
      delete: [] as BatchOperation<T>[],
      archive: [] as BatchOperation<T>[],
      restore: [] as BatchOperation<T>[]
    });
  }
}