import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('gifts')
@Index('IDX_gifts_search_vector', { synchronize: false })
@Index('IDX_gifts_title_trgm', { synchronize: false })
@Index('IDX_gifts_category_price', ['category', 'price'])
export class Gift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index('IDX_gifts_title')
  title: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  @Index('IDX_gifts_price')
  price: number;

  @Column()
  @Index('IDX_gifts_category')
  category: string;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  purchaseCount: number;

  @Column({ default: true })
  isActive: boolean;

  // Search vector column 
  
  @Column('tsvector', { select: false, nullable: true })
  searchVector?: any;

  @CreateDateColumn()
  @Index('IDX_gifts_created_at')
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  userId: string;
}