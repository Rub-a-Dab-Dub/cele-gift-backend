import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AdminEntity } from './admin.entity';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  FAILED_LOGIN = 'failed_login',
  PASSWORD_CHANGE = 'password_change',
  PERMISSION_GRANT = 'permission_grant',
  PERMISSION_REVOKE = 'permission_revoke',
  ROLE_ASSIGN = 'role_assign',
  ROLE_UNASSIGN = 'role_unassign',
  CONFIG_CHANGE = 'config_change',
  SYSTEM_ACTION = 'system_action',
  BULK_OPERATION = 'bulk_operation'
}

export enum AuditLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

@Entity('admin_audit_logs')
@Index(['adminId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['resource', 'createdAt'])
@Index(['level', 'createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  adminId: string;

  @ManyToOne(() => AdminEntity, admin => admin.auditLogs, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  admin: AdminEntity;

  @Column({
    type: 'enum',
    enum: AuditAction
  })
  action: AuditAction;

  @Column({ nullable: true })
  resource: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: AuditLevel,
    default: AuditLevel.MEDIUM
  })
  level: AuditLevel;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ default: false })
  isSystemAction: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
} 