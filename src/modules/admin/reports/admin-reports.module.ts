import { Module } from '@nestjs/common';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminAuditModule } from '../audit/admin-audit.module';

@Module({
  imports: [AdminAuditModule],
  controllers: [AdminReportsController],
  providers: [AdminReportsService],
  exports: [AdminReportsService],
})
export class AdminReportsModule {} 