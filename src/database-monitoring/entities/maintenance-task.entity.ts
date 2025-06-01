import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskType {
  INDEX_REBUILD = 'index_rebuild',
  STATISTICS_UPDATE = 'statistics_update',
  VACUUM = 'vacuum',
  ANALYZE = 'analyze',
  CLEANUP = 'cleanup',
  BACKUP = 'backup',
}

@Entity('maintenance_tasks')
export class MaintenanceTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: TaskType,
  })
  type: TaskType;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column('text', { nullable: true })
  description: string;

  @Column({ name: 'cron_expression' })
  cronExpression: string;

  @Column('json', { nullable: true })
  parameters: Record<string, any>;

  @Column({ name: 'last_run', nullable: true })
  lastRun: Date;

  @Column({ name: 'next_run', nullable: true })
  nextRun: Date;

  @Column({ name: 'execution_time', nullable: true })
  executionTime: number; // milliseconds

  @Column('text', { nullable: true })
  result: string;

  @Column('text', { nullable: true })
  error: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}