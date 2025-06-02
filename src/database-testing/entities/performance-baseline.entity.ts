import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('performance_baselines')
@Index(['name', 'version'])
export class PerformanceBaseline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  version: string;

  @Column('text')
  description: string;

  @Column({ name: 'test_suite' })
  testSuite: string;

  @Column({ name: 'test_name' })
  testName: string;

  @Column('json', { name: 'baseline_metrics' })
  baselineMetrics: {
    duration: number;
    memory: any;
    queries: any;
    cpu: any;
  };

  @Column('json', { name: 'thresholds' })
  thresholds: {
    max?: number;
    avg?: number;
    p95?: number;
    memory?: number;
    queries?: number;
  };

  @Column({ name: 'sample_size' })
  sampleSize: number;

  @Column('decimal', { name: 'confidence_level', precision: 5, scale: 2 })
  confidenceLevel: number;

  @Column({ name: 'environment' })
  environment: string;

  @Column({ name: 'database_version' })
  databaseVersion: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column('json', { name: 'statistical_data', nullable: true })
  statisticalData: {
    mean: number;
    median: number;
    standardDeviation: number;
    percentiles: Record<string, number>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
