import { IsString, IsEnum, IsOptional, IsDate, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType, NotificationPriority } from '../enums/notification.enums';

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  aggregationKey?: string;
}
