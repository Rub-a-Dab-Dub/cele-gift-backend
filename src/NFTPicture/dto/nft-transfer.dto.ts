// src/dto/nft-transfer.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateNftTransferDto {
  @IsString()
  @IsNotEmpty()
  nftPictureId: string;

  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsOptional()
  @IsString()
  fromAddress?: string;

  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  transferType?: string;
}
