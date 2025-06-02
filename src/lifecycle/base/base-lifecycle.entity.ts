import { 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  BeforeInsert,
  BeforeUpdate 
} from 'typeorm';
import { ILifecycleEntity } from '../interfaces/lifecycle-entity.interface';

export abstract class BaseLifecycleEntity implements ILifecycleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ nullable: true })
  archivedAt?: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;

  @BeforeInsert()
  beforeInsert() {
    this.isDeleted = false;
    this.isArchived = false;
  }

  @BeforeUpdate()
  beforeUpdate() {
    this.updatedAt = new Date();
  }
}