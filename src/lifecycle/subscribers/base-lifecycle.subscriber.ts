import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ILifecycleEventData } from '../interfaces/lifecycle-event.interface';
import { LifecycleEvent } from '../enums/lifecycle-event.enum';
import { DataConsistencyValidator } from '../validators/data-consistency.validator';
import { LifecycleEventService } from '../services/lifecycle-event.service';

@Injectable()
export abstract class BaseLifecycleSubscriber {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected dataValidator: DataConsistencyValidator,
    protected lifecycleEventService: LifecycleEventService
  ) {}

  @OnEvent(LifecycleEvent.BEFORE_CREATE)
  async handleBeforeCreate(data: ILifecycleEventData): Promise<void> {
    await this.validateEntity(data);
    await this.onBeforeCreate(data);
  }

  @OnEvent(LifecycleEvent.AFTER_CREATE)
  async handleAfterCreate(data: ILifecycleEventData): Promise<void> {
    await this.onAfterCreate(data);
  }

  @OnEvent(LifecycleEvent.BEFORE_UPDATE)
  async handleBeforeUpdate(data: ILifecycleEventData): Promise<void> {
    await this.validateEntity(data);
    await this.onBeforeUpdate(data);
  }

  @OnEvent(LifecycleEvent.AFTER_UPDATE)
  async handleAfterUpdate(data: ILifecycleEventData): Promise<void> {
    await this.onAfterUpdate(data);
  }

  @OnEvent(LifecycleEvent.BEFORE_DELETE)
  async handleBeforeDelete(data: ILifecycleEventData): Promise<void> {
    await this.onBeforeDelete(data);
  }

  @OnEvent(LifecycleEvent.AFTER_DELETE)
  async handleAfterDelete(data: ILifecycleEventData): Promise<void> {
    await this.onAfterDelete(data);
  }

  @OnEvent(LifecycleEvent.BEFORE_RESTORE)
  async handleBeforeRestore(data: ILifecycleEventData): Promise<void> {
    await this.onBeforeRestore(data);
  }

  @OnEvent(LifecycleEvent.AFTER_RESTORE)
  async handleAfterRestore(data: ILifecycleEventData): Promise<void> {
    await this.onAfterRestore(data);
  }

  @OnEvent(LifecycleEvent.BEFORE_ARCHIVE)
  async handleBeforeArchive(data: ILifecycleEventData): Promise<void> {
    await this.onBeforeArchive(data);
  }

  @OnEvent(LifecycleEvent.AFTER_ARCHIVE)
  async handleAfterArchive(data: ILifecycleEventData): Promise<void> {
    await this.onAfterArchive(data);
  }

  private async validateEntity(data: ILifecycleEventData): Promise<void> {
    const entityType = data.entity?.constructor?.name;
    if (!entityType) return;

    const validationResult = await this.dataValidator.validate(entityType, data.entity);
    if (!validationResult.isValid) {
      await this.lifecycleEventService.emit(LifecycleEvent.VALIDATION_FAILED, {
        ...data,
        metadata: { ...data.metadata, validationErrors: validationResult.errors }
      });
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }
  }

  // Abstract methods to be implemented by concrete subscribers
  protected abstract onBeforeCreate(data: ILifecycleEventData): Promise<void>;
  protected abstract onAfterCreate(data: ILifecycleEventData): Promise<void>;
  protected abstract onBeforeUpdate(data: ILifecycleEventData): Promise<void>;
  protected abstract onAfterUpdate(data: ILifecycleEventData): Promise<void>;
  protected abstract onBeforeDelete(data: ILifecycleEventData): Promise<void>;
  protected abstract onAfterDelete(data: ILifecycleEventData): Promise<void>;
  protected abstract onBeforeRestore(data: ILifecycleEventData): Promise<void>;
  protected abstract onAfterRestore(data: ILifecycleEventData): Promise<void>;
  protected abstract onBeforeArchive(data: ILifecycleEventData): Promise<void>;
  protected abstract onAfterArchive(data: ILifecycleEventData): Promise<void>;
}