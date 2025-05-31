import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Celebrity } from './celebrity.entity';

@Entity('celebrity_followers')
@Index(['celebrityId', 'followerId'], { unique: true })
@Index(['followerId', 'createdAt'])
@Index(['celebrityId', 'createdAt'])
export class CelebrityFollower {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  celebrityId: string;

  @Column('uuid')
  @Index()
  followerId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Celebrity, (celebrity) => celebrity.followers)
  celebrity: Celebrity;

  @ManyToOne(() => Celebrity, (celebrity) => celebrity.following)
  follower: Celebrity;
}
