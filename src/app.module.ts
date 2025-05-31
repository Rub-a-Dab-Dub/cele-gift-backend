import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransactionsModule } from './transactions/transactions.module';
import { CelebrityModule } from './celebrity/celebrity.module';

@Module({
  imports: [TransactionsModule, CelebrityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
