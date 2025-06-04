// src/dto/create-nft-picture.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsBoolean, IsObject } from 'class-validator';

export class CreateNftPictureDto {
  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  contractAddress: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  originalImageUrl?: string;

  @IsObject()
  metadata: Record<string, any>;

  @IsOptional()
  @IsArray()
  attributes?: Array<{ trait_type: string; value: string; rarity?: number }>;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  ipfsHash?: string;

  @IsOptional()
  @IsString()
  celebrityId?: string;

  @IsOptional()
  @IsString()
  collectionId?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
