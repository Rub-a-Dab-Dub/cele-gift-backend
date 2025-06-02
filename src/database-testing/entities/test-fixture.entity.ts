import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum FixtureStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOADING = 'loading',
  FAILED = 'failed',
}

@Entity('test_fixtures')
export class TestFixture {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('text')
  description: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({
    type: 'enum',
    enum: FixtureStatus,
    default: FixtureStatus.ACTIVE,
  })
  status: FixtureStatus;

  @Column('simple-array', { nullable: true })
  dependencies: string[];

  @Column({ name: 'load_order', default: 0 })
  loadOrder: number;

  @Column('json', { name: 'fixture_data', nullable: true })
  fixtureData: Record<string, any>;

  @Column('json', { name: 'table_mapping', nullable: true })
  tableMapping: Record<string, string>;

  @Column({ name: 'auto_cleanup', default: true })
  autoCleanup: boolean;

  @Column({ name: 'last_loaded', nullable: true })
  lastLoaded: Date;

  @Column({ name: 'load_count', default: 0 })
  loadCount: number;

  @Column('text', { name: 'load_error', nullable: true })
  loadError: string;

  @Column('json', { name: 'validation_rules', nullable: true })
  validationRules: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
