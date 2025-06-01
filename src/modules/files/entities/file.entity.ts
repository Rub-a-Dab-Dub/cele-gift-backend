import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { FileType } from '../enums/file-type.enum';
import { TenantBaseEntity } from '../../tenant/entities/tenant-base.entity';

@Entity('files')
export class FileEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  originalName: string;

  @Column()
  path: string;

  @Column()
  relativePath: string;

  @Column({ type: 'enum', enum: FileType })
  type: FileType;

  @Column({ nullable: true })
  extension: string;

  @Column({ type: 'bigint', default: 0 })
  size: number;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ nullable: true })
  parentId: string;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  modifiedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: 0 })
  sortOrder: number;
}