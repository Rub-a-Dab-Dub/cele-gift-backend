import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { LifecycleEventService } from './lifecycle-event.service';
import { AuditService } from './audit.service';
import { VersioningService } from './versioning.service';
import { ILifecycleEntity } from '../interfaces/lifecycle-entity.interface';
import { LifecycleEvent } from '../enums/lifecycle-event.enum';
import { v4 as uuidv4 } from 'uuid';

export interface LifecycleOptions {
  userId?: string;
  skipValidation?: boolean;
  skipAudit?: boolean;
  skipVersioning?: boolean;
  cascadeOperations?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class LifecycleManagerService {
  private readonly logger = new Logger(LifecycleManagerService.name);

  constructor(
    private dataSource: DataSource,
    private lifecycleEventService: LifecycleEventService,
    private auditService: AuditService,
    private versioningService: VersioningService
  ) {}

  async create<T extends ILifecycleEntity>(
    repository: Repository<T>,
    entityData: Partial<T>,
    options: LifecycleOptions = {}
  ): Promise<T> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Prepare entity
      const entity = repository.create({
        ...entityData,
        version: 1,
        isDeleted: false,
        isArchived: false
      } as any);

      // Emit before create event
      await this.lifecycleEventService.emit(LifecycleEvent.BEFORE_CREATE, {
        entity,
        operation: LifecycleEvent.BEFORE_CREATE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      // Save entity
      const savedEntity = await queryRunner.manager.save(entity);

      // Create version if not skipped
      if (!options.skipVersioning) {
        await this.versioningService.createVersion(
          savedEntity.constructor.name,
          savedEntity.id,
          savedEntity.version,
          savedEntity,
          options.userId,
          transactionId
        );
      }

      // Create audit log if not skipped
      if (!options.skipAudit) {
        await this.auditService.createAuditLog({
          entityType: savedEntity.constructor.name,
          entityId: savedEntity.id,
          operation: 'CREATE',
          userId: options.userId,
          newData: savedEntity,
          metadata: options.metadata,
          transactionId
        });
      }

      // Emit after create event
      await this.lifecycleEventService.emit(LifecycleEvent.AFTER_CREATE, {
        entity: savedEntity,
        operation: LifecycleEvent.AFTER_CREATE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      await queryRunner.commitTransaction();
      return savedEntity;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in create operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update<T extends ILifecycleEntity>(
    repository: Repository<T>,
    id: string,
    updateData: Partial<T>,
    options: LifecycleOptions = {}
  ): Promise<T> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current entity
      const currentEntity = await repository.findOne({ where: { id } as any });
      if (!currentEntity) {
        throw new Error(`Entity with id ${id} not found`);
      }

      const previousVersion = { ...currentEntity };

      // Emit before update event
      await this.lifecycleEventService.emit(LifecycleEvent.BEFORE_UPDATE, {
        entity: currentEntity,
        previousVersion,
        operation: LifecycleEvent.BEFORE_UPDATE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      // Update entity
      const updatedEntity = repository.merge(currentEntity, {
        ...updateData,
        version: currentEntity.version + 1,
        updatedAt: new Date()
      });

      const savedEntity = await queryRunner.manager.save(updatedEntity);

      // Create version if not skipped
      if (!options.skipVersioning) {
        await this.versioningService.createVersion(
          savedEntity.constructor.name,
          savedEntity.id,
          savedEntity.version,
          savedEntity,
          options.userId,
          transactionId
        );
      }

      // Create audit log if not skipped
      if (!options.skipAudit) {
        await this.auditService.createAuditLog({
          entityType: savedEntity.constructor.name,
          entityId: savedEntity.id,
          operation: 'UPDATE',
          userId: options.userId,
          previousData: previousVersion,
          newData: savedEntity,
          metadata: options.metadata,
          transactionId
        });
      }

      // Emit after update event
      await this.lifecycleEventService.emit(LifecycleEvent.AFTER_UPDATE, {
        entity: savedEntity,
        previousVersion,
        operation: LifecycleEvent.AFTER_UPDATE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      await queryRunner.commitTransaction();
      return savedEntity;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in update operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async softDelete<T extends ILifecycleEntity>(
    repository: Repository<T>,
    id: string,
    options: LifecycleOptions = {}
  ): Promise<T> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entity = await repository.findOne({ where: { id } as any });
      if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
      }

      const previousVersion = { ...entity };

      // Emit before delete event
      await this.lifecycleEventService.emit(LifecycleEvent.BEFORE_DELETE, {
        entity,
        previousVersion,
        operation: LifecycleEvent.BEFORE_DELETE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      // Soft delete
      entity.isDeleted = true;
      entity.deletedAt = new Date();
      entity.version += 1;
      entity.updatedAt = new Date();

      const savedEntity = await queryRunner.manager.save(entity);

      // Create version if not skipped
      if (!options.skipVersioning) {
        await this.versioningService.createVersion(
          savedEntity.constructor.name,
          savedEntity.id,
          savedEntity.version,
          savedEntity,
          options.userId,
          transactionId
        );
      }

      // Create audit log if not skipped
      if (!options.skipAudit) {
        await this.auditService.createAuditLog({
          entityType: savedEntity.constructor.name,
          entityId: savedEntity.id,
          operation: 'SOFT_DELETE',
          userId: options.userId,
          previousData: previousVersion,
          newData: savedEntity,
          metadata: options.metadata,
          transactionId
        });
      }

      // Emit after delete event
      await this.lifecycleEventService.emit(LifecycleEvent.AFTER_DELETE, {
        entity: savedEntity,
        previousVersion,
        operation: LifecycleEvent.AFTER_DELETE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      await queryRunner.commitTransaction();
      return savedEntity;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in soft delete operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async restore<T extends ILifecycleEntity>(
    repository: Repository<T>,
    id: string,
    options: LifecycleOptions = {}
  ): Promise<T> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entity = await repository.findOne({ 
        where: { id, isDeleted: true } as any,
        withDeleted: true 
      });
      
      if (!entity) {
        throw new Error(`Deleted entity with id ${id} not found`);
      }

      const previousVersion = { ...entity };

      // Emit before restore event
      await this.lifecycleEventService.emit(LifecycleEvent.BEFORE_RESTORE, {
        entity,
        previousVersion,
        operation: LifecycleEvent.BEFORE_RESTORE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      // Restore entity
      entity.isDeleted = false;
      entity.deletedAt = null;
      entity.version += 1;
      entity.updatedAt = new Date();

      const savedEntity = await queryRunner.manager.save(entity);

      // Create version if not skipped
      if (!options.skipVersioning) {
        await this.versioningService.createVersion(
          savedEntity.constructor.name,
          savedEntity.id,
          savedEntity.version,
          savedEntity,
          options.userId,
          transactionId
        );
      }

      // Create audit log if not skipped
      if (!options.skipAudit) {
        await this.auditService.createAuditLog({
          entityType: savedEntity.constructor.name,
          entityId: savedEntity.id,
          operation: 'RESTORE',
          userId: options.userId,
          previousData: previousVersion,
          newData: savedEntity,
          metadata: options.metadata,
          transactionId
        });
      }

      // Emit after restore event
      await this.lifecycleEventService.emit(LifecycleEvent.AFTER_RESTORE, {
        entity: savedEntity,
        previousVersion,
        operation: LifecycleEvent.AFTER_RESTORE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      await queryRunner.commitTransaction();
      return savedEntity;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in restore operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async archive<T extends ILifecycleEntity>(
    repository: Repository<T>,
    id: string,
    options: LifecycleOptions = {}
  ): Promise<T> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entity = await repository.findOne({ where: { id } as any });
      if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
      }

      const previousVersion = { ...entity };

      // Emit before archive event
      await this.lifecycleEventService.emit(LifecycleEvent.BEFORE_ARCHIVE, {
        entity,
        previousVersion,
        operation: LifecycleEvent.BEFORE_ARCHIVE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      // Archive entity
      entity.isArchived = true;
      entity.archivedAt = new Date();
      entity.version += 1;
      entity.updatedAt = new Date();

      const savedEntity = await queryRunner.manager.save(entity);

      // Create version if not skipped
      if (!options.skipVersioning) {
        await this.versioningService.createVersion(
          savedEntity.constructor.name,
          savedEntity.id,
          savedEntity.version,
          savedEntity,
          options.userId,
          transactionId
        );
      }

      // Create audit log if not skipped
      if (!options.skipAudit) {
        await this.auditService.createAuditLog({
          entityType: savedEntity.constructor.name,
          entityId: savedEntity.id,
          operation: 'ARCHIVE',
          userId: options.userId,
          previousData: previousVersion,
          newData: savedEntity,
          metadata: options.metadata,
          transactionId
        });
      }

      // Emit after archive event
      await this.lifecycleEventService.emit(LifecycleEvent.AFTER_ARCHIVE, {
        entity: savedEntity,
        previousVersion,
        operation: LifecycleEvent.AFTER_ARCHIVE,
        userId: options.userId,
        metadata: options.metadata,
        transactionId
      });

      await queryRunner.commitTransaction();
      return savedEntity;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in archive operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Bulk operations
  async bulkCreate<T extends ILifecycleEntity>(
    repository: Repository<T>,
    entitiesData: Partial<T>[],
    options: LifecycleOptions = {}
  ): Promise<T[]> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: T[] = [];
      const auditLogs: any[] = [];
      const versions: any[] = [];

      for (const entityData of entitiesData) {
        const entity = repository.create({
          ...entityData,
          version: 1,
          isDeleted: false,
          isArchived: false
        } as any);

        const savedEntity = await queryRunner.manager.save(entity);
        results.push(savedEntity);

        if (!options.skipVersioning) {
          versions.push({
            entityType: savedEntity.constructor.name,
            entityId: savedEntity.id,
            version: savedEntity.version,
            data: savedEntity,
            userId: options.userId,
            transactionId
          });
        }

        if (!options.skipAudit) {
          auditLogs.push({
            entityType: savedEntity.constructor.name,
            entityId: savedEntity.id,
            operation: 'BULK_CREATE',
            userId: options.userId,
            newData: savedEntity,
            metadata: options.metadata,
            transactionId
          });
        }
      }

      // Bulk save versions and audit logs
      if (versions.length > 0) {
        await queryRunner.manager.save('EntityVersion', versions);
      }
      
      if (auditLogs.length > 0) {
        await queryRunner.manager.save('AuditLog', auditLogs);
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in bulk create operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkSoftDelete<T extends ILifecycleEntity>(
    repository: Repository<T>,
    ids: string[],
    options: LifecycleOptions = {}
  ): Promise<T[]> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entities = await repository.findByIds(ids);
      const results: T[] = [];
      const auditLogs: any[] = [];
      const versions: any[] = [];

      for (const entity of entities) {
        const previousVersion = { ...entity };
        
        entity.isDeleted = true;
        entity.deletedAt = new Date();
        entity.version += 1;
        entity.updatedAt = new Date();

        const savedEntity = await queryRunner.manager.save(entity);
        results.push(savedEntity);

        if (!options.skipVersioning) {
          versions.push({
            entityType: savedEntity.constructor.name,
            entityId: savedEntity.id,
            version: savedEntity.version,
            data: savedEntity,
            userId: options.userId,
            transactionId
          });
        }

        if (!options.skipAudit) {
          auditLogs.push({
            entityType: savedEntity.constructor.name,
            entityId: savedEntity.id,
            operation: 'BULK_SOFT_DELETE',
            userId: options.userId,
            previousData: previousVersion,
            newData: savedEntity,
            metadata: options.metadata,
            transactionId
          });
        }
      }

      // Bulk save versions and audit logs
      if (versions.length > 0) {
        await queryRunner.manager.save('EntityVersion', versions);
      }
      
      if (auditLogs.length > 0) {
        await queryRunner.manager.save('AuditLog', auditLogs);
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error in bulk soft delete operation:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}