import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FinanceModule } from './finance/finance.module';
import { UsersModule } from './modules/users/users.module';
import { databaseConfig } from './config/database.config';



@Module({
  imports: [FinanceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
