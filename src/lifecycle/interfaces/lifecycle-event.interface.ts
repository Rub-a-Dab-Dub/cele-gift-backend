import { LifecycleEvent } from '../enums/lifecycle-event.enum';

export interface ILifecycleEventData<T = any> {
  entity: T;
  previousVersion?: T;
  operation: LifecycleEvent;
  userId?: string;
  metadata?: Record<string, any>;
  transactionId?: string;
}