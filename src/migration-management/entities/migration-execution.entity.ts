import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Migration, MigrationStatus } from './migration.entity';
import { MigrationEnvironment } from './migration-environment.entity';

@Entity('migration_executions')
export class MigrationExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  migrationId: string;

  @Column()
  environmentId: string;

  @Column({ type: 'enum', enum: MigrationStatus })
  status: MigrationStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'json', nullable: true })
  executionLog?: Record<string, any>[];

  @Column({ type: 'json', nullable: true })
  rollbackData?: Record<string, any>;

  @Column({ default: 0 })
  executionTime: number;

  @Column()
  executedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Migration, migration => migration.executions)
  @JoinColumn({ name: 'migrationId' })
  migration: Migration;

  @ManyToOne(() => MigrationEnvironment, env => env.executions)
  @JoinColumn({ name: 'environmentId' })
  environment: MigrationEnvironment;
}
