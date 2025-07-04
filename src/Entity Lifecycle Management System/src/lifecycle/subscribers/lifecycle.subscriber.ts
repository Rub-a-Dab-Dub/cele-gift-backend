import {
  EventSubscriber,
  type EntitySubscriberInterface,
  type InsertEvent,
  type UpdateEvent,
  type RemoveEvent,
} from "typeorm"
import { Injectable } from "@nestjs/common"
import { BaseLifecycleEntity } from "../entities/base-lifecycle.entity"

@Injectable()
@EventSubscriber()
export class LifecycleSubscriber implements EntitySubscriberInterface<BaseLifecycleEntity> {
  listenTo() {
    return BaseLifecycleEntity
  }

  beforeInsert(event: InsertEvent<BaseLifecycleEntity>) {
    console.log(`BEFORE ENTITY INSERTED: `, event.entity)

    // Validate entity before insertion
    this.validateEntity(event.entity)

    // Set default metadata if not provided
    if (!event.entity.metadata) {
      event.entity.metadata = {}
    }
  }

  afterInsert(event: InsertEvent<BaseLifecycleEntity>) {
    console.log(`AFTER ENTITY INSERTED: `, event.entity)
  }

  beforeUpdate(event: UpdateEvent<BaseLifecycleEntity>) {
    console.log(`BEFORE ENTITY UPDATED: `, event.entity)

    if (event.entity) {
      // Validate entity before update
      this.validateEntity(event.entity)

      // Check if entity is locked
      if (event.entity.isLocked) {
        throw new Error(`Cannot update locked entity: ${event.entity.lockReason}`)
      }
    }
  }

  afterUpdate(event: UpdateEvent<BaseLifecycleEntity>) {
    console.log(`AFTER ENTITY UPDATED: `, event.entity)
  }

  beforeRemove(event: RemoveEvent<BaseLifecycleEntity>) {
    console.log(`BEFORE ENTITY REMOVED: `, event.entity)

    if (event.entity) {
      // Check if entity is locked
      if (event.entity.isLocked) {
        throw new Error(`Cannot remove locked entity: ${event.entity.lockReason}`)
      }
    }
  }

  afterRemove(event: RemoveEvent<BaseLifecycleEntity>) {
    console.log(`AFTER ENTITY REMOVED: `, event.entity)
  }

  private validateEntity(entity: BaseLifecycleEntity): void {
    // Add custom validation logic here
    if (!entity.id && !entity.createdAt) {
      // This is a new entity, perform creation validation
      this.validateForCreation(entity)
    } else {
      // This is an existing entity, perform update validation
      this.validateForUpdate(entity)
    }
  }

  private validateForCreation(entity: BaseLifecycleEntity): void {
    // Override in specific implementations
  }

  private validateForUpdate(entity: BaseLifecycleEntity): void {
    // Override in specific implementations
  }
}
