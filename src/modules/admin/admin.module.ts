import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminPermissionsModule } from './permissions/admin-permissions.module';
import { AdminAuditModule } from './audit/admin-audit.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminUserManagementModule } from './user-management/admin-user-management.module';
import { AdminConfigModule } from './config/admin-config.module';
import { AdminNotificationsModule } from './notifications/admin-notifications.module';
import { AdminReportsModule } from './reports/admin-reports.module';
import { AdminEntity } from './entities/admin.entity';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { AdminAuthModule } from './auth/admin-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminEntity]),
    AdminPermissionsModule,
    AdminAuditModule,
    AdminDashboardModule,
    AdminUserManagementModule,
    AdminConfigModule,
    AdminNotificationsModule,
    AdminReportsModule,
    AdminAuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {} 