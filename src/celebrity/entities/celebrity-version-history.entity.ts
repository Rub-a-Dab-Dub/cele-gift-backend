import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Celebrity } from './celebrity.entity';

@Entity('celebrity_version_history')
@Index(['celebrityId', 'createdAt'])
export class CelebrityVersionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  celebrityId: string;

  @Column({ type: 'json' })
  previousData: Record<string, any>;

  @Column({ type: 'json' })
  changedFields: string[];

  @Column()
  changedBy: string;

  @Column({ nullable: true })
  changeReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Celebrity, (celebrity) => celebrity.versionHistory)
  celebrity: Celebrity;
}
