import { IsEnum, IsBoolean, IsOptional, IsString } from 'class-validator';
import { NotificationType, DeliveryChannel, NotificationFrequency } from '../enums/notification.enums';

export class UpdatePreferencesDto {
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @IsEnum(DeliveryChannel)
  channel: DeliveryChannel;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsEnum(NotificationFrequency)
  frequency?: NotificationFrequency;

  @IsOptional()
  @IsString()
  timeWindow?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}