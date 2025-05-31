import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction, Repository, Between } from 'typeorm';
import { TransactionAggregate } from '../entities/transaction-aggregate.entity';
import { TransactionStatus } from '../entities/transaction.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionAggregate)
    private aggregateRepository: Repository<TransactionAggregate>,
  ) {}

  async updateDailyAggregates(date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all token addresses that had transactions on this date
    const tokenAddresses = await this.transactionRepository
      .createQueryBuilder('tx')
      .select('DISTINCT tx.tokenAddress', 'tokenAddress')
      .where('tx.createdAt >= :startOfDay', { startOfDay })
      .andWhere('tx.createdAt <= :endOfDay', { endOfDay })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawMany();

    for (const { tokenAddress } of tokenAddresses) {
      await this.createDailyAggregate(tokenAddress, date);
    }
  }

  private async createDailyAggregate(
    tokenAddress: string,
    date: Date,
  ): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    interface TransactionStats {
      transactionCount: string;
      totalVolume: string;
      totalFees: string;
      uniqueAddresses: string;
    }

    const stats = (await this.transactionRepository
      .createQueryBuilder('tx')
      .select([
        'COUNT(*) as transactionCount',
        'SUM(CAST(tx.amount AS DECIMAL(36,18))) as totalVolume',
        'SUM(CAST(tx.fee AS DECIMAL(36,18))) as totalFees',
        'COUNT(DISTINCT CASE WHEN tx.fromAddress IS NOT NULL THEN tx.fromAddress END) + COUNT(DISTINCT CASE WHEN tx.toAddress IS NOT NULL THEN tx.toAddress END) as uniqueAddresses',
      ])
      .where('tx.tokenAddress = :tokenAddress', { tokenAddress })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
      .andWhere('tx.createdAt <= :endOfDay', { endOfDay })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne<TransactionStats>()) ?? {
      transactionCount: '0',
      totalVolume: '0',
      totalFees: '0',
      uniqueAddresses: '0',
    };

    // Get type breakdown
    const typeBreakdown = await this.transactionRepository
      .createQueryBuilder('tx')
      .select(['tx.type', 'COUNT(*) as count'])
      .where('tx.tokenAddress = :tokenAddress', { tokenAddress })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
      .andWhere('tx.createdAt <= :endOfDay', { endOfDay })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .groupBy('tx.type')
      .getRawMany();

    interface TypeCount {
      tx_type: string;
      count: string;
    }

    const typeBreakdownObj = typeBreakdown.reduce<Record<string, number>>(
      (acc, row: TypeCount) => {
        acc[row.tx_type] = parseInt(row.count);
        return acc;
      },
      {},
    );

    // Upsert aggregate record
    const aggregate = this.aggregateRepository.create({
      tokenAddress,
      date: startOfDay,
      period: 'daily',
      transactionCount: parseInt(stats.transactionCount) || 0,
      totalVolume: stats.totalVolume || '0',
      totalFees: stats.totalFees || '0',
      uniqueAddresses: parseInt(stats.uniqueAddresses) || 0,
      typeBreakdown: typeBreakdownObj,
    });

    await this.aggregateRepository.save(aggregate);
  }

  async getAnalytics(tokenAddress: string, fromDate: Date, toDate: Date) {
    const aggregates = await this.aggregateRepository.find({
      where: {
        tokenAddress,
        date: Between(fromDate, toDate),
        period: 'daily',
      },
      order: { date: 'ASC' },
    });

    const summary = aggregates.reduce(
      (acc, agg) => ({
        totalTransactions: acc.totalTransactions + Number(agg.transactionCount),
        totalVolume: (
          BigInt(acc.totalVolume) + BigInt(agg.totalVolume)
        ).toString(),
        totalFees: (BigInt(acc.totalFees) + BigInt(agg.totalFees)).toString(),
        uniqueAddresses: Math.max(acc.uniqueAddresses, agg.uniqueAddresses),
      }),
      {
        totalTransactions: 0,
        totalVolume: '0',
        totalFees: '0',
        uniqueAddresses: 0,
      },
    );

    return {
      summary,
      dailyData: aggregates,
    };
  }
}
