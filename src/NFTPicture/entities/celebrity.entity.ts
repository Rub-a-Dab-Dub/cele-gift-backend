// src/entities/celebrity.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { NftPicture } from './nft-picture.entity';

@Entity('celebrities')
@Index(['name'])
@Index(['popularity'])
export class Celebrity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  profileImageUrl: string;

  @Column({ default: 0 })
  popularity: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => NftPicture, nftPicture => nftPicture.celebrity)
  nftPictures: NftPicture[];
}
