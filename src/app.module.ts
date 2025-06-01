import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TransactionsModule } from './transactions/transactions.module';
import { CelebrityModule } from './celebrity/celebrity.module';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [FinanceModule, TransactionsModule, CelebrityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
