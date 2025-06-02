import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
}

@Entity('test_executions')
@Index(['testSuite', 'testName'])
@Index(['status', 'createdAt'])
export class TestExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_suite' })
  testSuite: string;

  @Column({ name: 'test_name' })
  testName: string;

  @Column({ name: 'test_file' })
  testFile: string;

  @Column({
    type: 'enum',
    enum: TestStatus,
    default: TestStatus.PENDING,
  })
  status: TestStatus;

  @Column({ name: 'start_time', nullable: true })
  startTime: Date;

  @Column({ name: 'end_time', nullable: true })
  endTime: Date;

  @Column({ name: 'duration', nullable: true })
  duration: number; // milliseconds

  @Column('text', { nullable: true })
  error: string;

  @Column('json', { name: 'stack_trace', nullable: true })
  stackTrace: any;

  @Column('json', { name: 'assertions', nullable: true })
  assertions: {
    total: number;
    passed: number;
    failed: number;
    details: any[];
  };

  @Column('json', { name: 'performance_metrics', nullable: true })
  performanceMetrics: {
    duration: number;
    memory: any;
    queries: any;
    cpu: any;
  };

  @Column('simple-array', { nullable: true })
  fixtures: string[];

  @Column('json', { name: 'test_context', nullable: true })
  testContext: Record<string, any>;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @Column({ name: 'isolation_level', nullable: true })
  isolationLevel: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
