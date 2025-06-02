import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('entity_versions')
@Index(['entityType', 'entityId'])
@Index(['version'])
export class EntityVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column()
  version: number;

  @Column('jsonb')
  data: any;

  @Column({ nullable: true })
  userId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  transactionId?: string;
}