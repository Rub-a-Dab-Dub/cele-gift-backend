import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
  } from 'typeorm';
  import { NotificationDelivery } from './notification-delivery.entity';
  import { NotificationType, NotificationPriority } from '../enums/notification.enums';
  
  @Entity('notifications')
  export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    userId: string;
  
    @Column({
      type: 'enum',
      enum: NotificationType,
    })
    type: NotificationType;
  
    @Column()
    title: string;
  
    @Column('text')
    content: string;
  
    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;
  
    @Column({
      type: 'enum',
      enum: NotificationPriority,
      default: NotificationPriority.MEDIUM,
    })
    priority: NotificationPriority;
  
    @Column({ nullable: true })
    templateId: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
    @Column({ nullable: true })
    scheduledAt: Date;
  
    @Column({ nullable: true })
    expiresAt: Date;
  
    @OneToMany(() => NotificationDelivery, delivery => delivery.notification)
    deliveries: NotificationDelivery[];
  
    @Column({ nullable: true })
    aggregationKey: string;
  
    @Column({ default: false })
    isRead: boolean;
  
    @Column({ default: false })
    isArchived: boolean;
  
    @Column({ nullable: true })
    readAt: Date;
  }