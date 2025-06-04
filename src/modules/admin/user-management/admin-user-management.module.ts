import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { AdminUserManagementService } from './services/admin-user-management.service';
import { AdminUserManagementController } from './controllers/admin-user-management.controller';
import { AdminAuditModule } from '../audit/admin-audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    AdminAuditModule,
  ],
  controllers: [AdminUserManagementController],
  providers: [AdminUserManagementService],
  exports: [AdminUserManagementService],
})
export class AdminUserManagementModule {} 