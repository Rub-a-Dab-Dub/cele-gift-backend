import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  token: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column()
  type: 'deposit' | 'withdrawal' | 'transfer';

  @Column({ default: false })
  reconciled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}