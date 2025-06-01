import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { Transaction } from './entities/transaction.entity';
import { Fee } from './entities/fee.entity';
import { Revenue } from './entities/revenue.entity';
import { AnomalyLog } from './entities/anomaly-log.entity';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { JwtStrategy } from './shared/strategies/jwt.strategy';
import { AuditLogMiddleware } from './shared/middleware/audit-log.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Fee, Revenue, AnomalyLog]),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1d' },
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
  ],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class FinanceModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditLogMiddleware).forRoutes('*');
  }
}