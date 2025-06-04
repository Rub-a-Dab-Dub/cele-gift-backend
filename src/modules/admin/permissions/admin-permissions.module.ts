import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminRole } from '../entities/admin-role.entity';
import { AdminPermission } from '../entities/admin-permission.entity';
import { AdminPermissionsService } from './services/admin-permissions.service';
import { AdminPermissionsController } from './controllers/admin-permissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminRole, AdminPermission]),
  ],
  controllers: [AdminPermissionsController],
  providers: [AdminPermissionsService],
  exports: [AdminPermissionsService],
})
export class AdminPermissionsModule {} 