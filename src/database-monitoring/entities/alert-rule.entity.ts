import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused',
}

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({ name: 'metric_type' })
  metricType: string;

  @Column({ name: 'threshold_value', type: 'decimal', precision: 10, scale: 2 })
  thresholdValue: number;

  @Column({ name: 'comparison_operator' })
  comparisonOperator: string; // '>', '<', '>=', '<=', '=='

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ name: 'evaluation_window', default: 300 }) // seconds
  evaluationWindow: number;

  @Column('json', { nullable: true })
  conditions: Record<string, any>;

  @Column('simple-array', { name: 'notification_channels' })
  notificationChannels: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}