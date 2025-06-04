import { Module } from '@nestjs/common';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminAuditModule } from '../audit/admin-audit.module';

@Module({
  imports: [AdminAuditModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {} 