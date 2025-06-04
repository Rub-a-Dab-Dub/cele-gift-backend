import { Module } from '@nestjs/common';
import { AdminNotificationsService } from './services/admin-notifications.service';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { AdminAuditModule } from '../audit/admin-audit.module';

@Module({
  imports: [AdminAuditModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {} 