import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { Notification } from './notification.entity';
  import { DeliveryChannel, DeliveryStatus } from '../enums/notification.enums';
  
  @Entity('notification_deliveries')
  export class NotificationDelivery {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => Notification, notification => notification.deliveries)
    @JoinColumn({ name: 'notification_id' })
    notification: Notification;
  
    @Column({ name: 'notification_id' })
    notificationId: string;
  
    @Column({
      type: 'enum',
      enum: DeliveryChannel,
    })
    channel: DeliveryChannel;
  
    @Column({
      type: 'enum',
      enum: DeliveryStatus,
      default: DeliveryStatus.PENDING,
    })
    status: DeliveryStatus;
  
    @Column()
    recipient: string;
  
    @Column({ default: 0 })
    attempts: number;
  
    @Column({ default: 3 })
    maxAttempts: number;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @Column({ nullable: true })
    sentAt: Date;
  
    @Column({ nullable: true })
    deliveredAt: Date;
  
    @Column({ nullable: true })
    failedAt: Date;
  
    @Column('text', { nullable: true })
    errorMessage: string;
  
    @Column({ nullable: true })
    nextRetryAt: Date;
  
    @Column('jsonb', { nullable: true })
    providerResponse: Record<string, any>;
  }