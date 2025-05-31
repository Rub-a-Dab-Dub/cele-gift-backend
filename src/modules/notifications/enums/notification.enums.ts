export enum NotificationType {
    GIFT_REMINDER = 'gift_reminder',
    GIFT_RECEIVED = 'gift_received',
    OCCASION_REMINDER = 'occasion_reminder',
    SYSTEM_ANNOUNCEMENT = 'system_announcement',
    MARKETING = 'marketing',
  }
  
  export enum DeliveryChannel {
    EMAIL = 'email',
    PUSH = 'push',
    SMS = 'sms',
    IN_APP = 'in_app',
  }
  
  export enum DeliveryStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    RETRY = 'retry',
  }
  
  export enum NotificationPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
  }
  
  export enum NotificationFrequency {
    IMMEDIATE = 'immediate',
    DAILY = 'daily',
    WEEKLY = 'weekly',
  }