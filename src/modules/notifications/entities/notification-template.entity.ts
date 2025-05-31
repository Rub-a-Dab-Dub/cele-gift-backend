import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { NotificationType, DeliveryChannel } from '../enums/notification.enums';
  
  @Entity('notification_templates')
  export class NotificationTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    name: string;
  
    @Column({
      type: 'enum',
      enum: NotificationType,
    })
    type: NotificationType;
  
    @Column({
      type: 'enum',
      enum: DeliveryChannel,
    })
    channel: DeliveryChannel;
  
    @Column({ nullable: true })
    subject: string;
  
    @Column('text')
    bodyTemplate: string;
  
    @Column('jsonb')
    variables: string[];
  
    @Column({ default: true })
    isActive: boolean;
  
    @Column({ default: 1 })
    version: number;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }