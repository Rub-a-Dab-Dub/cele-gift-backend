import { Module } from '@nestjs/common';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminAuditModule } from '../audit/admin-audit.module';

@Module({
  imports: [AdminAuditModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule {} 