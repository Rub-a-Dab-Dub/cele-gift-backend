import { Injectable } from '@nestjs/common';
import { BaseLifecycleSubscriber } from '../subscribers/base-lifecycle.subscriber';
import { ILifecycleEventData } from '../interfaces/lifecycle-event.interface';
import { DataConsistencyValidator } from '../validators/data-consistency.validator';
import { LifecycleEventService } from '../services/lifecycle-event.service';
import { User } from './user.entity';

@Injectable()
export class UserLifecycleSubscriber extends BaseLifecycleSubscriber {
  constructor(
    protected dataValidator: DataConsistencyValidator,
    protected lifecycleEventService: LifecycleEventService
  ) {
    super(dataValidator, lifecycleEventService);
    this.registerValidationRules();
  }

  private registerValidationRules(): void {
    // Email uniqueness validation
    this.dataValidator.registerRule<User>('User', {
      name: 'email_uniqueness',
      validate: async (user: User) => {
        // This would typically check against database
        // Implementation depends on your specific needs
        return user.email && user.email.includes('@');
      },
      message: 'Email must be valid and unique'
    });

    // Active user validation
    this.dataValidator.registerRule<User>('User', {
      name: 'active_user_department',
      validate: (user: User) => {
        if (user.isActive && !user.department) {
          return false;
        }
        return true;
      },
      message: 'Active users must have a department assigned'
    });
  }

  protected async onBeforeCreate(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.email} is being created`);
    // Custom logic before user creation
  }

  protected async onAfterCreate(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.email} has been created with ID ${data.entity.id}`);
    // Send welcome email, create user profile, etc.
  }

  protected async onBeforeUpdate(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} is being updated`);
    // Check if sensitive fields are being changed
  }

  protected async onAfterUpdate(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} has been updated`);
    // Invalidate cache, send notifications, etc.
  }

  protected async onBeforeDelete(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} is being soft deleted`);
    // Check if user has dependent records
  }

  protected async onAfterDelete(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} has been soft deleted`);
    // Cleanup related data, send notifications
  }

  protected async onBeforeRestore(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} is being restored`);
  }

  protected async onAfterRestore(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} has been restored`);
  }

  protected async onBeforeArchive(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} is being archived`);
  }

  protected async onAfterArchive(data: ILifecycleEventData<User>): Promise<void> {
    this.logger.log(`User ${data.entity.id} has been archived`);
  }
}