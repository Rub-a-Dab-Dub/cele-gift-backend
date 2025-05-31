import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity('ledger_entries')
@Index(['accountAddress', 'tokenAddress'])
@Index(['transactionId'])
@Index(['createdAt'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  transactionId: string;

  @Column({ type: 'varchar', length: 42 })
  @Index()
  accountAddress: string;

  @Column({ type: 'varchar', length: 42 })
  @Index()
  tokenAddress: string;

  @Column({ type: 'enum', enum: ['debit', 'credit'] })
  entryType: 'debit' | 'credit';

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  balanceBefore: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  balanceAfter: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;
}
