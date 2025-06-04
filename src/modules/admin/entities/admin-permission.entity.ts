import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PermissionType {
  RESOURCE = 'resource',
  ACTION = 'action',
  SYSTEM = 'system'
}

export enum PermissionScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  USER = 'user'
}

@Entity('admin_permissions')
export class AdminPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PermissionType,
    default: PermissionType.ACTION
  })
  type: PermissionType;

  @Column({
    type: 'enum',
    enum: PermissionScope,
    default: PermissionScope.GLOBAL
  })
  scope: PermissionScope;

  @Column({ nullable: true })
  resource: string;

  @Column({ nullable: true })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemPermission: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;
} 