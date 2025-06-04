// src/entities/nft-ownership.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { NftPicture } from './nft-picture.entity';

@Entity('nft_ownerships')
@Index(['nftPictureId', 'ownerAddress'], { unique: true })
@Index(['ownerAddress'])
@Index(['acquiredAt'])
export class NftOwnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftPictureId: string;

  @Column()
  ownerAddress: string;

  @Column({ nullable: true })
  ownerName: string;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  purchasePrice: number;

  @Column({ default: 'ETH' })
  purchaseCurrency: string;

  @CreateDateColumn()
  acquiredAt: Date;

  @ManyToOne(() => NftPicture, nftPicture => nftPicture.ownerships)
  nftPicture: NftPicture;
}
