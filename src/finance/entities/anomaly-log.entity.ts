import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('anomaly_logs')
export class AnomalyLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column()
  description: string;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;
}