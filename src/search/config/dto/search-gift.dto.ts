import { IsOptional, IsString, IsArray, IsNumber, IsBoolean, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchGiftDto {
  @ApiPropertyOptional({ description: 'Search query string' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Categories to filter by', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  categories?: string[];

  @ApiPropertyOptional({ description: 'Tags to filter by', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  tags?: string[];

  @ApiPropertyOptional({ description: 'Minimum price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['relevance', 'date', 'price', 'popularity'] })
  @IsOptional()
  @IsIn(['relevance', 'date', 'price', 'popularity'])
  sortBy?: 'relevance' | 'date' | 'price' | 'popularity' = 'relevance';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Page number', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Results per page', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Facets to include', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  facets?: string[] = ['categories', 'priceRanges', 'tags'];

  @ApiPropertyOptional({ description: 'Enable result highlighting' })
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  @IsBoolean()
  highlight?: boolean = true;

  @ApiPropertyOptional({ description: 'Enable search suggestions' })
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  @IsBoolean()
  suggestions?: boolean = true;
}