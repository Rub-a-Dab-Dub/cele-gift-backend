// src/entities/nft-collection.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { NftPicture } from './nft-picture.entity';

@Entity('nft_collections')
@Index(['name'])
@Index(['contractAddress'], { unique: true })
export class NftCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column()
  contractAddress: string;

  @Column({ nullable: true })
  coverImageUrl: string;

  @Column({ nullable: true })
  bannerImageUrl: string;

  @Column({ default: 0 })
  totalSupply: number;

  @Column({ default: 0 })
  floorPrice: number;

  @Column({ default: 'ETH' })
  currency: string;

  @Column({ default: 0 })
  volume: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => NftPicture, nftPicture => nftPicture.collection)
  nftPictures: NftPicture[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
