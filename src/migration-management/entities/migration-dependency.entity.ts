import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Migration } from './migration.entity';

@Entity('migration_dependencies')
export class MigrationDependency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  migrationId: string;

  @Column()
  dependsOnId: string;

  @Column({ default: false })
  isHard: boolean;

  @ManyToOne(() => Migration, migration => migration.dependencies)
  @JoinColumn({ name: 'migrationId' })
  migration: Migration;

  @ManyToOne(() => Migration)
  @JoinColumn({ name: 'dependsOnId' })
  dependsOn: Migration;
}