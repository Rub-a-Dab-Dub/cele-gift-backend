import {
  IsString,
  IsEnum,
  IsOptional,
  IsUrl,
  IsObject,
  Length,
  Matches,
} from 'class-validator';
import { CelebrityCategory } from '../entities/celebrity.entity';

export class CreateCelebrityDto {
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @IsString()
  @Length(1, 100)
  displayName: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  bio?: string;

  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsEnum(CelebrityCategory)
  category: CelebrityCategory;

  @IsOptional()
  @IsObject()
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
  };

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
