// src/entities/nft-transfer.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { NftPicture } from './nft-picture.entity';

@Entity('nft_transfers')
@Index(['nftPictureId'])
@Index(['fromAddress'])
@Index(['toAddress'])
@Index(['transferredAt'])
export class NftTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftPictureId: string;

  @Column()
  transactionHash: string;

  @Column({ nullable: true })
  fromAddress: string;

  @Column()
  toAddress: string;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  price: number;

  @Column({ default: 'ETH' })
  currency: string;

  @Column({ default: 'transfer' })
  transferType: string; // 'mint', 'transfer', 'sale'

  @CreateDateColumn()
  transferredAt: Date;

  @ManyToOne(() => NftPicture, nftPicture => nftPicture.transfers)
  nftPicture: NftPicture;
}
