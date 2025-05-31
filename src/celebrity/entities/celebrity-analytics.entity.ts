import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Celebrity } from './celebrity.entity';

@Entity('celebrity_analytics')
@Index(['celebrityId', 'date'], { unique: true })
@Index(['date', 'engagementScore'])
export class CelebrityAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  celebrityId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int', default: 0 })
  profileViews: number;

  @Column({ type: 'int', default: 0 })
  newFollowers: number;

  @Column({ type: 'int', default: 0 })
  unfollowers: number;

  @Column({ type: 'int', default: 0 })
  contentViews: number;

  @Column({ type: 'int', default: 0 })
  contentLikes: number;

  @Column({ type: 'int', default: 0 })
  contentShares: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementScore: number;

  @Column({ type: 'json', nullable: true })
  demographicData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Celebrity, (celebrity) => celebrity.analytics)
  celebrity: Celebrity;
}
