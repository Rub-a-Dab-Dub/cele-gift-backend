// src/entities/nft-picture.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Celebrity } from './celebrity.entity';
import { NftOwnership } from './nft-ownership.entity';
import { NftTransfer } from './nft-transfer.entity';
import { NftCollection } from './nft-collection.entity';

@Entity('nft_pictures')
@Index(['tokenId', 'contractAddress'], { unique: true })
@Index(['celebrityId'])
@Index(['collectionId'])
@Index(['popularity'])
@Index(['createdAt'])
export class NftPicture {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tokenId: string;

  @Column()
  contractAddress: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column()
  imageUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ nullable: true })
  originalImageUrl: string;

  @Column('jsonb')
  metadata: Record<string, any>;

  @Column('jsonb', { nullable: true })
  attributes: Array<{ trait_type: string; value: string; rarity?: number }>;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  price: number;

  @Column({ default: 'ETH' })
  currency: string;

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  likes: number;

  @Column({ default: 0 })
  popularity: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  ipfsHash: string;

  @Column({ nullable: true })
  celebrityId: string;

  @Column({ nullable: true })
  collectionId: string;

  @ManyToOne(() => Celebrity, celebrity => celebrity.nftPictures)
  celebrity: Celebrity;

  @ManyToOne(() => NftCollection, collection => collection.nftPictures)
  collection: NftCollection;

  @OneToMany(() => NftOwnership, ownership => ownership.nftPicture)
  ownerships: NftOwnership[];

  @OneToMany(() => NftTransfer, transfer => transfer.nftPicture)
  transfers: NftTransfer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
