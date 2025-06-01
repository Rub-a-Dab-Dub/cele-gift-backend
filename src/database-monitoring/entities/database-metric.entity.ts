import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('database_metrics')
@Index(['metricType', 'timestamp'])
export class DatabaseMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'metric_type' })
  metricType: string;

  @Column({ name: 'metric_name' })
  metricName: string;

  @Column('decimal', { precision: 10, scale: 2 })
  value: number;

  @Column({ nullable: true })
  unit: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'database_name', nullable: true })
  databaseName: string;

  @Column({ name: 'table_name', nullable: true })
  tableName: string;
}