import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
  } from 'typeorm';
  import { NotificationType, DeliveryChannel, NotificationFrequency } from '../enums/notification.enums';
  
  @Entity('user_notification_preferences')
  @Unique(['userId', 'notificationType', 'channel'])
  export class UserNotificationPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    userId: string;
  
    @Column({
      type: 'enum',
      enum: NotificationType,
    })
    notificationType: NotificationType;
  
    @Column({
      type: 'enum',
      enum: DeliveryChannel,
    })
    channel: DeliveryChannel;
  
    @Column({ default: true })
    enabled: boolean;
  
    @Column({
      type: 'enum',
      enum: NotificationFrequency,
      nullable: true,
    })
    frequency: NotificationFrequency;
  
    @Column({ nullable: true })
    timeWindow: string; // "09:00-18:00"
  
    @Column({ default: 'UTC' })
    timezone: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }