import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array',
  ENCRYPTED = 'encrypted'
}

export enum ConfigCategory {
  SYSTEM = 'system',
  SECURITY = 'security',
  NOTIFICATION = 'notification',
  FEATURE = 'feature',
  INTEGRATION = 'integration',
  UI = 'ui',
  BUSINESS = 'business'
}

@Entity('admin_configs')
@Index(['category', 'key'])
@Index(['isActive'])
export class AdminConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ConfigCategory,
    default: ConfigCategory.SYSTEM
  })
  category: ConfigCategory;

  @Column({
    type: 'enum',
    enum: ConfigType,
    default: ConfigType.STRING
  })
  type: ConfigType;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'text', nullable: true })
  defaultValue: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isReadOnly: boolean;

  @Column({ default: false })
  isEncrypted: boolean;

  @Column({ default: false })
  requiresRestart: boolean;

  @Column({ type: 'jsonb', nullable: true })
  validationRules: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  updatedBy: string;
} 