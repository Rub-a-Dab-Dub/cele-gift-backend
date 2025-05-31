import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumberString,
  IsEthereumAddress,
} from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsString()
  hash: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEthereumAddress()
  @IsOptional()
  fromAddress?: string;

  @IsEthereumAddress()
  @IsOptional()
  toAddress?: string;

  @IsNumberString()
  amount: string;

  @IsEthereumAddress()
  tokenAddress: string;

  @IsNumberString()
  @IsOptional()
  fee?: string;

  @IsOptional()
  blockNumber?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
