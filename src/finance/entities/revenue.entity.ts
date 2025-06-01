import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('revenues')
export class Revenue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column()
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}