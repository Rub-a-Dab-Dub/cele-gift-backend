import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { UserNotificationPreference } from '../entities/user-notification-preference.entity';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationTemplateService } from './notification-template.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { GetNotificationsDto } from '../dto/get-notifications.dto';
import { PaginatedResult } from '../interfaces/notification.interfaces';
import { NotificationType } from '../enums/notification.enums';
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(UserNotificationPreference)
    private preferenceRepo: Repository<UserNotificationPreference>,
    private queueService: NotificationQueueService,
    private templateService: NotificationTemplateService,
  ) {}

  async createNotification(data: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      ...data,
      scheduledAt: data.scheduledAt || new Date(),
      expiresAt: data.expiresAt || this.calculateExpiry(data.type),
    });

    await this.notificationRepo.save(notification);
    await this.queueService.scheduleNotification(notification);

    return notification;
  }
  async createBulkNotifications(notifications: CreateNotificationDto[]): Promise<void> {
    await this.notificationRepo.manager.transaction(async manager => {
      const processedNotifications = notifications.map(n => ({
        ...n,
        scheduledAt: n.scheduledAt || new Date(),
        expiresAt: n.expiresAt || this.calculateExpiry(n.type),
      }));

      const savedNotifications = await manager.save(Notification, processedNotifications);
      
      for (const notification of savedNotifications) {
        await this.queueService.scheduleNotification(notification);
    });
  }

  async getNotificationsForUser(
    userId: string, 
    options: GetNotificationsDto
  ): Promise<PaginatedResult<Notification>> {
    const queryBuilder = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.deliveries', 'd')
      .where('n.userId = :userId', { userId })
      .andWhere('n.expiresAt > :now', { now: new Date() });

    if (options.type) {
      queryBuilder.andWhere('n.type = :type', { type: options.type });
    }

    if (options.unreadOnly) {
      queryBuilder.andWhere('n.isRead = false');
    }

    queryBuilder
      .orderBy('n.createdAt', 'DESC')
      .skip(options.offset)
      .take(options.limit);

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      items: notifications,
      total,
    };
  }
    return {
      items: notifications,
      total,
      page: Math.floor(options.offset / options.limit) + 1,
      totalPages: Math.ceil(total / options.limit),
    };

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId, userId },
      { isRead: true, readAt: new Date() }
    );
  }

  async checkDeliveryPermission(notificationId: string): Promise<boolean> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) return false;

    const preferences = await this.preferenceRepo.find({
      where: {
        userId: notification.userId,
        notificationType: notification.type,
      },
    });

    return preferences.some(pref => pref.enabled);
  }

  async getEnabledChannels(notificationId: string): Promise<string[]> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) return [];

    const preferences = await this.preferenceRepo.find({
      where: {
        userId: notification.userId,
        notificationType: notification.type,
        enabled: true,
      },
    });

    return preferences.map(pref => pref.channel);
  }

  private calculateExpiry(type: NotificationType): Date {
    const now = new Date();
    const days = type === NotificationType.SYSTEM_ANNOUNCEMENT ? 30 : 7;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private calculateDelay(scheduledAt: Date): number {
    return Math.max(0, scheduledAt.getTime() - Date.now());
  }

  async markAsSkipped(notificationId: string): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId },
      { isArchived: true }
    );
  }
}


