import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Transaction } from '../entities/transaction.entity';
import { WebhookService } from '../services/webhook.service';
import { AnalyticsService } from '../services/analytics.service';

@Injectable()
export class TransactionListener {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @OnEvent('transaction.created')
  async handleTransactionCreated(transaction: Transaction) {
    await this.webhookService.sendTransactionWebhook(
      transaction,
      'transaction.created',
    );
  }

  @OnEvent('transaction.completed')
  async handleTransactionCompleted(transaction: Transaction) {
    // Send webhook
    await this.webhookService.sendTransactionWebhook(
      transaction,
      'transaction.completed',
    );

    // Update analytics (async)
    setTimeout(() => {
      this.analyticsService.updateDailyAggregates(new Date()).catch(error => {
        console.error('Failed to update daily aggregates:', error);
      });
    }, 1000);
  }
}
