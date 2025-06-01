import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendTransactionWebhook(
    transaction: Transaction,
    event: string,
  ): Promise<void> {
    const webhookUrls = process.env.WEBHOOK_URLS?.split(',') || [];

    const payload = {
      event,
      transaction: {
        id: transaction.id,
        hash: transaction.hash,
        type: transaction.type,
        status: transaction.status,
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        amount: transaction.amount,
        tokenAddress: transaction.tokenAddress,
        fee: transaction.fee,
        blockNumber: transaction.blockNumber,
        createdAt: transaction.createdAt,
        confirmedAt: transaction.confirmedAt,
      },
      timestamp: new Date().toISOString(),
    };

    for (const url of webhookUrls) {
      try {
        await this.httpService
          .post(url.trim(), payload, {
            timeout: 5000,
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Event': event,
            },
          })
          .toPromise();

        this.logger.log(`Webhook sent successfully to ${url}`);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to send webhook to ${url}:`, errorMessage);
      }
    }
  }
}
