import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Celebrity } from './celebrity.entity';

@Entity('celebrity_content')
@Index(['celebrityId', 'createdAt'])
@Index(['contentType', 'isPublished'])
export class CelebrityContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  celebrityId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'post' })
  contentType: string;

  @Column({ default: true })
  isPublished: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  shareCount: number;

  @Column({ type: 'json', nullable: true })
  mediaUrls: string[];

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Celebrity, (celebrity) => celebrity.content)
  celebrity: Celebrity;
}
