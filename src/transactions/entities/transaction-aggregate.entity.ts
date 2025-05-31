import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionType } from './transaction.entity';

@Entity('transaction_aggregates')
@Index(['tokenAddress', 'period', 'date'])
export class TransactionAggregate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 42 })
  @Index()
  tokenAddress: string;

  @Column({ type: 'date' })
  @Index()
  date: Date;

  @Column({ type: 'enum', enum: ['hourly', 'daily', 'weekly', 'monthly'] })
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';

  @Column({ type: 'bigint', default: 0 })
  transactionCount: number;

  @Column({ type: 'decimal', precision: 36, scale: 18, default: '0' })
  totalVolume: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, default: '0' })
  totalFees: string;

  @Column({ type: 'int', default: 0 })
  uniqueAddresses: number;

  @Column({ type: 'json', nullable: true })
  typeBreakdown: Record<TransactionType, number>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
