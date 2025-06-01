import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEntry } from '../entities/ledger-entry.entity';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  private balanceCache = new Map<string, string>();

  constructor(
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
  ) {}

  async getBalance(address: string, tokenAddress: string): Promise<string> {
    const cacheKey = `${address}:${tokenAddress}`;

    // Check cache first
    if (this.balanceCache.has(cacheKey)) {
      return this.balanceCache.get(cacheKey) || '0';
    }

    // Calculate balance from ledger entries
    const result = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select(
        "SUM(CASE WHEN entry.entryType = 'credit' THEN CAST(entry.amount AS DECIMAL(36,18)) ELSE -CAST(entry.amount AS DECIMAL(36,18)) END)",
        'balance',
      )
      .where('entry.accountAddress = :address', { address })
      .andWhere('entry.tokenAddress = :tokenAddress', { tokenAddress })
      .getRawOne<{ balance: string | null }>();

    const balance = result?.balance || '0';
    this.balanceCache.set(cacheKey, balance);

    return balance;
  }

  updateBalance(
    address: string,
    tokenAddress: string,
    newBalance: string,
  ): void {
    const cacheKey = `${address}:${tokenAddress}`;
    this.balanceCache.set(cacheKey, newBalance);
  }

  clearCache(): void {
    this.balanceCache.clear();
  }
}
