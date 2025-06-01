import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { TransactionAggregate } from './entities/transaction-aggregate.entity';
import { TransactionListener } from './listeners/transaction.listener';
import { AnalyticsService } from './services/analytics.service';
import { BalanceService } from './services/balance.service';
import { WebhookService } from './services/webhook.service';
import { TransactionService } from './services/transactions.service';
import { TransactionController } from './transactions.controller';
import { BullModule } from '@nestjs/bull';
import { AnalyticsJob } from './jobs/analytics.job';
import { TransactionProcessor } from './processors/transaction.processor';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter/dist';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, LedgerEntry, TransactionAggregate]),
    HttpModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'transaction-queue',
    }),
  ],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    BalanceService,
    AnalyticsService,
    WebhookService,
    TransactionListener,
    AnalyticsJob,
    TransactionProcessor,
  ],
  exports: [TransactionService, BalanceService, AnalyticsService],
})
export class TransactionsModule {}
