import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TransactionService } from '../services/transactions.service';

@Processor('transaction-queue')
export class TransactionProcessor {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(private readonly transactionService: TransactionService) {}

  @Process('process-transaction')
  async processTransaction(job: Job<{ transactionId: string }>) {
    const { transactionId } = job.data;

    try {
      this.logger.log(`Processing transaction: ${transactionId}`);
      await this.transactionService.processTransaction(transactionId);
      this.logger.log(`Successfully processed transaction: ${transactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process transaction ${transactionId}:`,
        error,
      );
      throw error; // This will mark the job as failed
    }
  }

  @Process('verify-transaction')
  async verifyTransaction(job: Job<{ transactionId: string }>) {
    const { transactionId } = job.data;

    try {
      this.logger.log(`Verifying transaction: ${transactionId}`);
      const isValid =
        await this.transactionService.verifyTransaction(transactionId);

      if (!isValid) {
        this.logger.warn(`Transaction verification failed: ${transactionId}`);
      }

      return { transactionId, isValid };
    } catch (error) {
      this.logger.error(
        `Failed to verify transaction ${transactionId}:`,
        error,
      );
      throw error;
    }
  }
}
