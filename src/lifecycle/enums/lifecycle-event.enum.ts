export enum LifecycleEvent {
  BEFORE_CREATE = 'before_create',
  AFTER_CREATE = 'after_create',
  BEFORE_UPDATE = 'before_update',
  AFTER_UPDATE = 'after_update',
  BEFORE_DELETE = 'before_delete',
  AFTER_DELETE = 'after_delete',
  BEFORE_RESTORE = 'before_restore',
  AFTER_RESTORE = 'after_restore',
  BEFORE_ARCHIVE = 'before_archive',
  AFTER_ARCHIVE = 'after_archive',
  VALIDATION_FAILED = 'validation_failed'
}