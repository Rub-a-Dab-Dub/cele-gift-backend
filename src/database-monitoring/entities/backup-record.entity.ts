import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  DIFFERENTIAL = 'differential',
}

export enum BackupStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  VERIFIED = 'verified',
  VERIFICATION_FAILED = 'verification_failed',
}

@Entity('backup_records')
export class BackupRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'database_name' })
  databaseName: string;

  @Column({
    type: 'enum',
    enum: BackupType,
  })
  type: BackupType;

  @Column({
    type: 'enum',
    enum: BackupStatus,
  })
  status: BackupStatus;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'checksum', nullable: true })
  checksum: string;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time', nullable: true })
  endTime: Date;

  @Column({ name: 'duration', nullable: true })
  duration: number; // seconds

  @Column({ name: 'verification_date', nullable: true })
  verificationDate: Date;

  @Column('text', { nullable: true })
  error: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}