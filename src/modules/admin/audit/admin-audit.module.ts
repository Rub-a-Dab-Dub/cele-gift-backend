import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AdminAuditService } from './services/admin-audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAuditLog]),
  ],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminAuditModule {} 