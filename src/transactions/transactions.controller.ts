import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { AnalyticsService } from './services/analytics.service';
import { TransactionService } from './services/transactions.service';

@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post()
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionService.createTransaction(createTransactionDto);
  }

  @Post(':id/process')
  async processTransaction(@Param('id') id: string) {
    return this.transactionService.processTransaction(id);
  }

  @Get()
  async getTransactionHistory(@Query() query: TransactionQueryDto) {
    return this.transactionService.getTransactionHistory(query);
  }

  @Get(':id')
  async getTransaction(@Param('id') id: string) {
    return this.transactionService.getTransactionById(id);
  }

  @Post(':id/verify')
  async verifyTransaction(@Param('id') id: string) {
    const isValid = await this.transactionService.verifyTransaction(id);
    return { valid: isValid };
  }

  @Get('analytics/:tokenAddress')
  async getAnalytics(
    @Param('tokenAddress') tokenAddress: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.analyticsService.getAnalytics(
      tokenAddress,
      new Date(fromDate),
      new Date(toDate),
    );
  }
}
