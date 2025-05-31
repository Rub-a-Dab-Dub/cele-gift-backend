import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationQueueService {
  constructor(
    @InjectQueue('notifications') private notificationQueue: Queue,
    @InjectQueue('delivery-retry') private retryQueue: Queue,
  ) {}

  async scheduleNotification(notification: Notification): Promise<void> {
    const delay = notification.scheduledAt 
      ? notification.scheduledAt.getTime() - Date.now() 
      : 0;

    await this.notificationQueue.add(
      'process-notification',
      { notificationId: notification.id },
      {
        delay: Math.max(0, delay),
        attempts: 3,
        backoff: 'exponential',
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  }

  async scheduleRetry(deliveryId: string, retryAt: Date): Promise<void> {
    const delay = retryAt.getTime() - Date.now();
    
    await this.retryQueue.add(
      'retry-delivery',
      { deliveryId },
      {
        delay: Math.max(0, delay),
        attempts: 1,
      }
    );
  }

  async addBulk(jobs: any[]): Promise<void> {
    await this.notificationQueue.addBulk(jobs);
  }
}