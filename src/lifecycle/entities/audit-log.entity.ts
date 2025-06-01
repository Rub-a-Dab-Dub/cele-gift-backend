import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { IAuditLog } from '../interfaces/audit-log.interface';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['timestamp'])
export class AuditLog implements IAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column()
  operation: string;

  @Column({ nullable: true })
  userId?: string;

  @Column('jsonb', { nullable: true })
  previousData?: any;

  @Column('jsonb', { nullable: true })
  newData?: any;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  transactionId?: string;
}