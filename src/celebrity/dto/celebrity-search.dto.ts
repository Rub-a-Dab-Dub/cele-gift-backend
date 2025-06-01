import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import {
  CelebrityCategory,
  VerificationStatus,
} from '../entities/celebrity.entity';

export class CelebritySearchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(CelebrityCategory)
  category?: CelebrityCategory;

  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(['relevance', 'followers', 'engagement', 'recent'])
  sortBy?: string = 'relevance';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: string = 'desc';
}
