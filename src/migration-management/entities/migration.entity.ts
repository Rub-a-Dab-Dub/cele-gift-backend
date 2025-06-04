import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MigrationExecution } from './migration-execution.entity';
import { MigrationDependency } from './migration-dependency.entity';

export enum MigrationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum MigrationType {
  SCHEMA = 'schema',
  DATA = 'data',
  SEED = 'seed',
  HOTFIX = 'hotfix',
}

@Entity('migrations')
export class Migration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  version: string;

  @Column({ type: 'enum', enum: MigrationType })
  type: MigrationType;

  @Column({ type: 'text' })
  upScript: string;

  @Column({ type: 'text' })
  downScript: string;

  @Column({ type: 'text', nullable: true })
  dataScript?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: false })
  requiresValidation: boolean;

  @Column({ default: false })
  isReversible: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  author: string;

  @Column({ nullable: true })
  gitCommit?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => MigrationExecution, execution => execution.migration)
  executions: MigrationExecution[];

  @OneToMany(() => MigrationDependency, dependency => dependency.migration)
  dependencies: MigrationDependency[];
}