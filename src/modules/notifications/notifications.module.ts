import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationService } from './services/notification.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationAggregationService } from './services/notification-aggregation.service';
import { NotificationAnalyticsService } from './services/notification-analytics.service';
import { NotificationCacheService } from './services/notification-cache.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationProcessor } from './processors/notification.processor';
import { DeliveryRetryProcessor } from './processors/delivery-retry.processor';
import { NotificationController } from './controllers/notification.controller';
import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { NotificationAnalyticsController } from './controllers/notification-analytics.controller';
import { NotificationHealthService } from './health/notification-health.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationDelivery,
      UserNotificationPreference,
      NotificationTemplate,
    ]),
    BullModule.registerQueue(
      {
        name: 'notifications',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
        },
      },
      {
        name: 'delivery-retry',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
        },
      },
    ),
  ],
  providers: [
    NotificationService,
    NotificationDeliveryService,
    NotificationAggregationService,
    NotificationAnalyticsService,
    NotificationCacheService,
    NotificationQueueService,
    NotificationTemplateService,
    NotificationProcessor,
    DeliveryRetryProcessor,
    NotificationHealthService,
  ],
  controllers: [
    NotificationController,
    NotificationPreferencesController,
    NotificationAnalyticsController,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}