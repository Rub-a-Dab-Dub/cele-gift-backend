import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import { BalanceService } from './balance.service';
import { WebhookService } from './webhook.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
    private dataSource: DataSource,
    private balanceService: BalanceService,
    private webhookService: WebhookService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check for duplicate transaction
      const existingTx = await queryRunner.manager.findOne(Transaction, {
        where: { hash: createTransactionDto.hash },
      });

      if (existingTx) {
        throw new ConflictException(
          'Transaction with this hash already exists',
        );
      }

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        ...createTransactionDto,
        status: TransactionStatus.PENDING,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Validate balances for transfer transactions
      if (
        createTransactionDto.type === TransactionType.TRANSFER &&
        createTransactionDto.fromAddress
      ) {
        const balance = await this.balanceService.getBalance(
          createTransactionDto.fromAddress,
          createTransactionDto.tokenAddress,
        );

        if (BigInt(balance) < BigInt(createTransactionDto.amount)) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      await queryRunner.commitTransaction();

      // Emit event for async processing
      try {
        this.eventEmitter.emit('transaction.created', savedTransaction);
      } catch (emitError) {
        this.logger.warn('Failed to emit transaction.created event', emitError);
      }

      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create transaction', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processTransaction(transactionId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE'); // Highest isolation level

    try {
      // Lock the transaction record
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transaction) {
        throw new BadRequestException('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        throw new BadRequestException('Transaction is not in pending status');
      }

      // Update status to processing
      transaction.status = TransactionStatus.PROCESSING;
      await queryRunner.manager.save(transaction);

      // Create double-entry ledger entries
      await this.createLedgerEntries(queryRunner, transaction);

      // Update transaction status
      transaction.status = TransactionStatus.COMPLETED;
      transaction.confirmedAt = new Date();
      const completedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // Trigger webhook and analytics update
      this.eventEmitter.emit('transaction.completed', completedTransaction);

      return completedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Update transaction status to failed
      try {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await this.transactionRepository.update(transactionId, {
          status: TransactionStatus.FAILED,
          failureReason: errorMessage,
        });
      } catch (updateError) {
        this.logger.error(
          'Failed to update transaction status to failed',
          updateError,
        );
      }

      this.logger.error('Failed to process transaction', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createLedgerEntries(
    queryRunner: QueryRunner,
    transaction: Transaction,
  ): Promise<void> {
    const entries: Partial<LedgerEntry>[] = [];

    switch (transaction.type) {
      case TransactionType.TRANSFER:
        if (transaction.fromAddress && transaction.toAddress) {
          // Debit from sender
          const senderBalance = await this.balanceService.getBalance(
            transaction.fromAddress,
            transaction.tokenAddress,
          );

          entries.push({
            transactionId: transaction.id,
            accountAddress: transaction.fromAddress,
            tokenAddress: transaction.tokenAddress,
            entryType: 'debit',
            amount: transaction.amount,
            balanceBefore: senderBalance,
            balanceAfter: (
              BigInt(senderBalance) - BigInt(transaction.amount)
            ).toString(),
            description: `Transfer to ${transaction.toAddress}`,
          });

          // Credit to receiver
          const receiverBalance = await this.balanceService.getBalance(
            transaction.toAddress,
            transaction.tokenAddress,
          );

          entries.push({
            transactionId: transaction.id,
            accountAddress: transaction.toAddress,
            tokenAddress: transaction.tokenAddress,
            entryType: 'credit',
            amount: transaction.amount,
            balanceBefore: receiverBalance,
            balanceAfter: (
              BigInt(receiverBalance) + BigInt(transaction.amount)
            ).toString(),
            description: `Transfer from ${transaction.fromAddress}`,
          });
        }
        break;

      case TransactionType.MINT:
        if (transaction.toAddress) {
          const balance = await this.balanceService.getBalance(
            transaction.toAddress,
            transaction.tokenAddress,
          );

          entries.push({
            transactionId: transaction.id,
            accountAddress: transaction.toAddress,
            tokenAddress: transaction.tokenAddress,
            entryType: 'credit',
            amount: transaction.amount,
            balanceBefore: balance,
            balanceAfter: (
              BigInt(balance) + BigInt(transaction.amount)
            ).toString(),
            description: 'Token mint',
          });
        }
        break;

      case TransactionType.BURN:
        if (transaction.fromAddress) {
          const balance = await this.balanceService.getBalance(
            transaction.fromAddress,
            transaction.tokenAddress,
          );

          entries.push({
            transactionId: transaction.id,
            accountAddress: transaction.fromAddress,
            tokenAddress: transaction.tokenAddress,
            entryType: 'debit',
            amount: transaction.amount,
            balanceBefore: balance,
            balanceAfter: (
              BigInt(balance) - BigInt(transaction.amount)
            ).toString(),
            description: 'Token burn',
          });
        }
        break;
    }

    // Save ledger entries
    for (const entryData of entries) {
      const entry = queryRunner.manager.create(LedgerEntry, entryData);
      await queryRunner.manager.save(entry);

      // Update balance cache
      if (
        !entryData.accountAddress ||
        !entryData.tokenAddress ||
        !entryData.balanceAfter
      ) {
        throw new Error('Missing required data for balance update');
      }
      this.balanceService.updateBalance(
        entryData.accountAddress,
        entryData.tokenAddress,
        entryData.balanceAfter,
      );
    }
  }

  async getTransactionHistory(query: TransactionQueryDto) {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.transaction', 'transaction');

    // Apply filters
    if (query.address) {
      queryBuilder.andWhere(
        '(tx.fromAddress = :address OR tx.toAddress = :address)',
        {
          address: query.address,
        },
      );
    }

    if (query.tokenAddress) {
      queryBuilder.andWhere('tx.tokenAddress = :tokenAddress', {
        tokenAddress: query.tokenAddress,
      });
    }

    if (query.type) {
      queryBuilder.andWhere('tx.type = :type', { type: query.type });
    }

    if (query.status) {
      queryBuilder.andWhere('tx.status = :status', { status: query.status });
    }

    if (query.fromDate) {
      queryBuilder.andWhere('tx.createdAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }

    if (query.toDate) {
      queryBuilder.andWhere('tx.createdAt <= :toDate', {
        toDate: query.toDate,
      });
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 10; // Default limit of 10 items per page
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Ordering
    queryBuilder.orderBy('tx.createdAt', 'DESC');

    const [transactions, total] = await queryBuilder.getManyAndCount();

    const limitPerPage = query.limit || 10;
    return {
      transactions,
      pagination: {
        page: query.page,
        limit: limitPerPage,
        total,
        pages: Math.ceil(total / limitPerPage),
      },
    };
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['ledgerEntries'],
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    return transaction;
  }

  async verifyTransaction(transactionId: string): Promise<boolean> {
    // const transaction = await this.getTransactionById(transactionId);

    // Get all ledger entries for this transaction
    const ledgerEntries = await this.ledgerRepository.find({
      where: { transactionId },
    });

    // Verify double-entry bookkeeping
    const totalDebits = ledgerEntries
      .filter((entry) => entry.entryType === 'debit')
      .reduce((sum, entry) => sum + BigInt(entry.amount), BigInt(0));

    const totalCredits = ledgerEntries
      .filter((entry) => entry.entryType === 'credit')
      .reduce((sum, entry) => sum + BigInt(entry.amount), BigInt(0));

    const isBalanced = totalDebits === totalCredits;

    if (!isBalanced) {
      this.logger.error(
        `Transaction ${transactionId} is not balanced: debits=${totalDebits}, credits=${totalCredits}`,
      );
    }

    return isBalanced;
  }
}
