import { Injectable } from "@nestjs/common"
import type { EventEmitter2 } from "@nestjs/event-emitter"
import type { DataSource, EntityTarget, DeepPartial } from "typeorm"
import { type AuditService, AuditAction } from "./audit.service"
import type { VersioningService } from "./versioning.service"
import type { ArchivingService } from "./archiving.service"
import type { BaseLifecycleEntity } from "../entities/base-lifecycle.entity"
import {
  EntityCreatedEvent,
  EntityUpdatedEvent,
  EntityDeletedEvent,
  EntityRestoredEvent,
  EntityArchivedEvent,
} from "../events/lifecycle.events"

export interface LifecycleContext {
  userId?: string
  reason?: string
  metadata?: Record<string, any>
  skipAudit?: boolean
  skipVersioning?: boolean
  isMajorVersion?: boolean
}

export interface BulkOperationResult<T> {
  successful: T[]
  failed: Array<{ entity: DeepPartial<T>; error: Error }>
  totalProcessed: number
}

@Injectable()
export class LifecycleService {
  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private versioningService: VersioningService,
    private archivingService: ArchivingService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    entityData: DeepPartial<T>,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(entityClass)
      const entity = repository.create({
        ...entityData,
        createdBy: context.userId,
      } as DeepPartial<T>)

      const savedEntity = await repository.save(entity)
      const entityType = entityClass.constructor.name

      // Emit event
      this.eventEmitter.emit(
        "entity.created",
        new EntityCreatedEvent(entityType, savedEntity.id, savedEntity, context.userId, context.metadata),
      )

      // Create audit log
      if (!context.skipAudit) {
        await this.auditService.logEntityChange(
          entityType,
          savedEntity.id,
          AuditAction.CREATE,
          null,
          savedEntity,
          context.userId,
          context.metadata,
        )
      }

      // Create initial version
      if (!context.skipVersioning) {
        await this.versioningService.createVersion({
          entityType,
          entityId: savedEntity.id,
          version: savedEntity.version,
          entityData: savedEntity,
          changeSummary: "Initial creation",
          changedBy: context.userId,
          isMajorVersion: true,
          metadata: context.metadata,
        })
      }

      return savedEntity
    })
  }

  async update<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    id: string,
    updateData: DeepPartial<T>,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(entityClass)
      const existingEntity = await repository.findOne({ where: { id } as any })

      if (!existingEntity) {
        throw new Error(`Entity with id ${id} not found`)
      }

      if (existingEntity.isLocked) {
        throw new Error(`Entity ${id} is locked: ${existingEntity.lockReason}`)
      }

      const oldValues = { ...existingEntity }
      const updatedEntity = repository.merge(existingEntity, {
        ...updateData,
        updatedBy: context.userId,
      } as DeepPartial<T>)

      const savedEntity = await repository.save(updatedEntity)
      const entityType = entityClass.constructor.name

      // Get changed fields
      const changedFields = this.getChangedFields(oldValues, savedEntity)

      // Emit event
      this.eventEmitter.emit(
        "entity.updated",
        new EntityUpdatedEvent(
          entityType,
          savedEntity.id,
          savedEntity,
          oldValues,
          changedFields,
          context.userId,
          context.metadata,
        ),
      )

      // Create audit log
      if (!context.skipAudit) {
        await this.auditService.logEntityChange(
          entityType,
          savedEntity.id,
          AuditAction.UPDATE,
          oldValues,
          savedEntity,
          context.userId,
          context.metadata,
        )
      }

      // Create version
      if (!context.skipVersioning) {
        await this.versioningService.createVersion({
          entityType,
          entityId: savedEntity.id,
          version: savedEntity.version,
          entityData: savedEntity,
          changeSummary: context.reason || `Updated fields: ${changedFields.join(", ")}`,
          changedBy: context.userId,
          isMajorVersion: context.isMajorVersion || false,
          metadata: context.metadata,
        })
      }

      return savedEntity
    })
  }

  async softDelete<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    id: string,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(entityClass)
      const entity = await repository.findOne({ where: { id } as any })

      if (!entity) {
        throw new Error(`Entity with id ${id} not found`)
      }

      if (entity.isLocked) {
        throw new Error(`Entity ${id} is locked: ${entity.lockReason}`)
      }

      const updatedEntity = await repository.save({
        ...entity,
        deletedAt: new Date(),
        deletedBy: context.userId,
      } as DeepPartial<T>)

      const entityType = entityClass.constructor.name

      // Emit event
      this.eventEmitter.emit(
        "entity.deleted",
        new EntityDeletedEvent(entityType, updatedEntity.id, updatedEntity, context.userId, context.metadata),
      )

      // Create audit log
      if (!context.skipAudit) {
        await this.auditService.logEntityChange(
          entityType,
          updatedEntity.id,
          AuditAction.DELETE,
          entity,
          updatedEntity,
          context.userId,
          context.metadata,
        )
      }

      return updatedEntity
    })
  }

  async restore<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    id: string,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(entityClass)
      const entity = await repository.findOne({
        where: { id } as any,
        withDeleted: true,
      })

      if (!entity) {
        throw new Error(`Entity with id ${id} not found`)
      }

      if (!entity.deletedAt) {
        throw new Error(`Entity ${id} is not deleted`)
      }

      const restoredEntity = await repository.save({
        ...entity,
        deletedAt: null,
        deletedBy: null,
        updatedBy: context.userId,
      } as DeepPartial<T>)

      const entityType = entityClass.constructor.name

      // Emit event
      this.eventEmitter.emit(
        "entity.restored",
        new EntityRestoredEvent(entityType, restoredEntity.id, restoredEntity, context.userId, context.metadata),
      )

      // Create audit log
      if (!context.skipAudit) {
        await this.auditService.logEntityChange(
          entityType,
          restoredEntity.id,
          AuditAction.RESTORE,
          entity,
          restoredEntity,
          context.userId,
          context.metadata,
        )
      }

      return restoredEntity
    })
  }

  async archive<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    id: string,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(entityClass)
      const entity = await repository.findOne({ where: { id } as any })

      if (!entity) {
        throw new Error(`Entity with id ${id} not found`)
      }

      // Archive the entity data
      await this.archivingService.archiveEntity({
        entityType: entityClass.constructor.name,
        entityId: entity.id,
        entityData: entity,
        archivedBy: context.userId,
        reason: context.reason,
        metadata: context.metadata,
      })

      // Update entity with archive timestamp
      const archivedEntity = await repository.save({
        ...entity,
        archivedAt: new Date(),
        archivedBy: context.userId,
      } as DeepPartial<T>)

      const entityType = entityClass.constructor.name

      // Emit event
      this.eventEmitter.emit(
        "entity.archived",
        new EntityArchivedEvent(entityType, archivedEntity.id, archivedEntity, context.userId, context.metadata),
      )

      // Create audit log
      if (!context.skipAudit) {
        await this.auditService.logEntityChange(
          entityType,
          archivedEntity.id,
          AuditAction.ARCHIVE,
          entity,
          archivedEntity,
          context.userId,
          context.metadata,
        )
      }

      return archivedEntity
    })
  }

  async bulkCreate<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    entitiesData: DeepPartial<T>[],
    context: LifecycleContext = {},
  ): Promise<BulkOperationResult<T>> {
    const result: BulkOperationResult<T> = {
      successful: [],
      failed: [],
      totalProcessed: entitiesData.length,
    }

    // Process in batches to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < entitiesData.length; i += batchSize) {
      const batch = entitiesData.slice(i, i + batchSize)

      await Promise.allSettled(
        batch.map(async (entityData) => {
          try {
            const entity = await this.create(entityClass, entityData, context)
            result.successful.push(entity)
          } catch (error) {
            result.failed.push({ entity: entityData, error: error as Error })
          }
        }),
      )
    }

    return result
  }

  async bulkUpdate<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    updates: Array<{ id: string; data: DeepPartial<T> }>,
    context: LifecycleContext = {},
  ): Promise<BulkOperationResult<T>> {
    const result: BulkOperationResult<T> = {
      successful: [],
      failed: [],
      totalProcessed: updates.length,
    }

    // Process in batches
    const batchSize = 50
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)

      await Promise.allSettled(
        batch.map(async (update) => {
          try {
            const entity = await this.update(entityClass, update.id, update.data, context)
            result.successful.push(entity)
          } catch (error) {
            result.failed.push({ entity: update.data, error: error as Error })
          }
        }),
      )
    }

    return result
  }

  async lock<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    id: string,
    reason: string,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.update(
      entityClass,
      id,
      {
        isLocked: true,
        lockReason: reason,
      } as DeepPartial<T>,
      context,
    )
  }

  async unlock<T extends BaseLifecycleEntity>(
    entityClass: EntityTarget<T>,
    id: string,
    context: LifecycleContext = {},
  ): Promise<T> {
    return this.update(
      entityClass,
      id,
      {
        isLocked: false,
        lockReason: null,
      } as DeepPartial<T>,
      context,
    )
  }

  private getChangedFields(oldEntity: any, newEntity: any): string[] {
    const changedFields: string[] = []
    const excludeFields = ["updatedAt", "version"]

    for (const key in newEntity) {
      if (excludeFields.includes(key)) continue

      if (oldEntity[key] !== newEntity[key]) {
        changedFields.push(key)
      }
    }

    return changedFields
  }
}
