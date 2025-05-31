import { NotificationType, DeliveryChannel, NotificationPriority } from '../enums/notification.enums';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  priority?: NotificationPriority;
  scheduledAt?: Date;
  expiresAt?: Date;
  templateId?: string;
  aggregationKey?: string;
}

export interface PaginationOptions {
  offset: number;
  limit: number;
}

export interface FilterOptions {
  type?: NotificationType;
  unreadOnly?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AggregatedNotification {
  aggregationKey: string;
  type: NotificationType;
  count: number;
  latestCreatedAt: Date;
  notificationIds: string[];
  summary: string;
}

export interface DeliveryStats {
  totalDeliveries: number;
  successRate: number;
  channelBreakdown: Record<DeliveryChannel, number>;
  statusBreakdown: Record<string, number>;
}

export interface EngagementMetrics {
  activeUsers: number;
  readRate: number;
  avgReadTimeMinutes: number;
}

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}