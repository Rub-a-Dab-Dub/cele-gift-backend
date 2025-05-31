import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TransactionType {
  TRANSFER = 'transfer',
  MINT = 'mint',
  BURN = 'burn',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('transactions')
@Index(['fromAddress', 'toAddress'])
@Index(['type', 'status'])
@Index(['createdAt'])
@Index(['blockNumber'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 66 })
  @Index()
  hash: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 42, nullable: true })
  @Index()
  fromAddress: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  @Index()
  toAddress: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'varchar', length: 42 })
  @Index()
  tokenAddress: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, default: '0' })
  fee: string;

  @Column({ type: 'bigint', nullable: true })
  @Index()
  blockNumber: number;

  @Column({ type: 'int', nullable: true })
  transactionIndex: number;

  @Column({ type: 'bigint', nullable: true })
  gasUsed: number;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  gasPrice: string;

  @Column({ type: 'text', nullable: true })
  data: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  confirmedAt: Date;
}
