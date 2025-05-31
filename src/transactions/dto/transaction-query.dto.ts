import { IsEnum, IsOptional, IsEthereumAddress } from 'class-validator';
import {
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

export class TransactionQueryDto {
  @IsOptional()
  @IsEthereumAddress()
  address?: string;

  @IsOptional()
  @IsEthereumAddress()
  tokenAddress?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  fromDate?: Date;

  @IsOptional()
  toDate?: Date;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
