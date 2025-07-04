export class EntityLifecycleEvent {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly action: string,
    public readonly entity: any,
    public readonly userId?: string,
    public readonly metadata?: Record<string, any>,
  ) {}
}

export class EntityCreatedEvent extends EntityLifecycleEvent {
  constructor(entityType: string, entityId: string, entity: any, userId?: string, metadata?: Record<string, any>) {
    super(entityType, entityId, "CREATED", entity, userId, metadata)
  }
}

export class EntityUpdatedEvent extends EntityLifecycleEvent {
  constructor(
    entityType: string,
    entityId: string,
    entity: any,
    public readonly oldValues: any,
    public readonly changedFields: string[],
    userId?: string,
    metadata?: Record<string, any>,
  ) {
    super(entityType, entityId, "UPDATED", entity, userId, metadata)
  }
}

export class EntityDeletedEvent extends EntityLifecycleEvent {
  constructor(entityType: string, entityId: string, entity: any, userId?: string, metadata?: Record<string, any>) {
    super(entityType, entityId, "DELETED", entity, userId, metadata)
  }
}

export class EntityRestoredEvent extends EntityLifecycleEvent {
  constructor(entityType: string, entityId: string, entity: any, userId?: string, metadata?: Record<string, any>) {
    super(entityType, entityId, "RESTORED", entity, userId, metadata)
  }
}

export class EntityArchivedEvent extends EntityLifecycleEvent {
  constructor(entityType: string, entityId: string, entity: any, userId?: string, metadata?: Record<string, any>) {
    super(entityType, entityId, "ARCHIVED", entity, userId, metadata)
  }
}
