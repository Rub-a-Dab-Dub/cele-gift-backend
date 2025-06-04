import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminConfig } from '../entities/admin-config.entity';
import { AdminConfigService } from './services/admin-config.service';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AdminAuditModule } from '../audit/admin-audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminConfig]),
    AdminAuditModule,
  ],
  controllers: [AdminConfigController],
  providers: [AdminConfigService],
  exports: [AdminConfigService],
})
export class AdminConfigModule {} 