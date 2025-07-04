import { Injectable } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"
import type {
  EntityCreatedEvent,
  EntityUpdatedEvent,
  EntityDeletedEvent,
  EntityRestoredEvent,
  EntityArchivedEvent,
} from "../events/lifecycle.events"

@Injectable()
export class LifecycleListener {
  @OnEvent("entity.created")
  handleEntityCreated(event: EntityCreatedEvent) {
    console.log(`Entity created: ${event.entityType}:${event.entityId}`)

    // Perform post-creation tasks
    this.performPostCreationTasks(event)
  }

  @OnEvent("entity.updated")
  handleEntityUpdated(event: EntityUpdatedEvent) {
    console.log(`Entity updated: ${event.entityType}:${event.entityId}`)
    console.log(`Changed fields: ${event.changedFields.join(", ")}`)

    // Perform post-update tasks
    this.performPostUpdateTasks(event)
  }

  @OnEvent("entity.deleted")
  handleEntityDeleted(event: EntityDeletedEvent) {
    console.log(`Entity deleted: ${event.entityType}:${event.entityId}`)

    // Perform post-deletion tasks
    this.performPostDeletionTasks(event)
  }

  @OnEvent("entity.restored")
  handleEntityRestored(event: EntityRestoredEvent) {
    console.log(`Entity restored: ${event.entityType}:${event.entityId}`)

    // Perform post-restoration tasks
    this.performPostRestorationTasks(event)
  }

  @OnEvent("entity.archived")
  handleEntityArchived(event: EntityArchivedEvent) {
    console.log(`Entity archived: ${event.entityType}:${event.entityId}`)

    // Perform post-archival tasks
    this.performPostArchivalTasks(event)
  }

  private performPostCreationTasks(event: EntityCreatedEvent) {
    // Send notifications, update caches, trigger workflows, etc.
  }

  private performPostUpdateTasks(event: EntityUpdatedEvent) {
    // Invalidate caches, send notifications, trigger workflows, etc.
  }

  private performPostDeletionTasks(event: EntityDeletedEvent) {
    // Clean up related data, send notifications, etc.
  }

  private performPostRestorationTasks(event: EntityRestoredEvent) {
    // Restore related data, send notifications, etc.
  }

  private performPostArchivalTasks(event: EntityArchivedEvent) {
    // Clean up active data, send notifications, etc.
  }
}
