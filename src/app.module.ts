import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FinanceModule } from './finance/finance.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [FinanceModule, TransactionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
