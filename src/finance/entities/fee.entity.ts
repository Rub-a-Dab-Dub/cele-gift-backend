import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fees')
export class Fee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transactionId: number;

  @Column()
  type: string; // e.g., platform, affiliate

  @Column('decimal', { precision: 5, scale: 2 })
  percentage: number;

  @CreateDateColumn()
  createdAt: Date;
}