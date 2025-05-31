import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CelebrityAnalytics } from './celebrity-analytics.entity';
import { CelebrityContent } from './celebrity-content.entity';
import { CelebrityFollower } from './celebrity-follower.entity';
import { CelebrityVersionHistory } from './celebrity-version-history.entity';

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum CelebrityCategory {
  ACTOR = 'actor',
  MUSICIAN = 'musician',
  ATHLETE = 'athlete',
  INFLUENCER = 'influencer',
  POLITICIAN = 'politician',
  WRITER = 'writer',
  DIRECTOR = 'director',
  OTHER = 'other',
}

@Entity('celebrities')
@Index(['verificationStatus', 'isActive'])
@Index(['category', 'followerCount'])
@Index(['searchVector'], { fulltext: true })
export class Celebrity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  username: string;

  @Column()
  displayName: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  profileImageUrl: string;

  @Column({ nullable: true })
  coverImageUrl: string;

  @Column({ type: 'enum', enum: CelebrityCategory })
  @Index()
  category: CelebrityCategory;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  @Index()
  verificationStatus: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  verificationNotes: string;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  @Index()
  followerCount: number;

  @Column({ type: 'int', default: 0 })
  followingCount: number;

  @Column({ type: 'int', default: 0 })
  contentCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  engagementRate: number;

  @Column({ type: 'text', nullable: true })
  searchVector: string;

  @Column({ type: 'json', nullable: true })
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
  };

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CelebrityContent, (content) => content.celebrity)
  content: CelebrityContent[];

  @OneToMany(() => CelebrityFollower, (follower) => follower.celebrity)
  followers: CelebrityFollower[];

  @OneToMany(() => CelebrityFollower, (follower) => follower.follower)
  following: CelebrityFollower[];

  @OneToMany(() => CelebrityAnalytics, (analytics) => analytics.celebrity)
  analytics: CelebrityAnalytics[];

  @OneToMany(() => CelebrityVersionHistory, (version) => version.celebrity)
  versionHistory: CelebrityVersionHistory[];
}
