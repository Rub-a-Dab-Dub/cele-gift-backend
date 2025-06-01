import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('capacity_metrics')
@Index(['metricType', 'timestamp'])
export class CapacityMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'metric_type' })
  metricType: string; // 'storage', 'connections', 'cpu', 'memory'

  @Column({ name: 'current_value', type: 'decimal', precision: 15, scale: 2 })
  currentValue: number;

  @Column({ name: 'max_value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxValue: number;

  @Column({ name: 'utilization_percentage', type: 'decimal', precision: 5, scale: 2 })
  utilizationPercentage: number;

  @Column({ name: 'database_name', nullable: true })
  databaseName: string;

  @Column('json', { nullable: true })
  breakdown: Record<string, any>;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}