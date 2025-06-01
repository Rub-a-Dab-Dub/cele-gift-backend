import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { TenantConnectionManager } from './services/tenant-connection-manager.service';
import { TenantMiddleware } from '../../common/middleware/tenant.middleware';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Module({
  providers: [
    TenantService,
    TenantConnectionManager,
    TenantGuard,
  ],
  exports: [
    TenantService,
    TenantConnectionManager,
    TenantGuard,
  ],
})
export class TenantModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}