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
      }async getNotificationsForUser(
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
    });
  }
