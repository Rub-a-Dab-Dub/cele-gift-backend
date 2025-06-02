import {
    IsOptional,
    IsInt,
    IsString,
    IsEnum,
    IsArray,
    IsObject,
    Min,
    Max,
    ValidateNested,
    IsBoolean,
  } from 'class-validator';
  import { Transform, Type } from 'class-transformer';
  import { ApiPropertyOptional } from '@nestjs/swagger';
  import { SortDirection, FilterOperator } from '../interfaces/pagination.interface';
  
  export class FilterDto {
    @ApiPropertyOptional({ description: 'Field to filter by' })
    @IsString()
    field: string;
  
    @ApiPropertyOptional({ enum: FilterOperator, description: 'Filter operator' })
    @IsEnum(FilterOperator)
    operator: FilterOperator;
  
    @ApiPropertyOptional({ description: 'Filter value' })
    value: any;
  
    @ApiPropertyOptional({ description: 'Relation path for nested filtering' })
    @IsOptional()
    @IsString()
    relation?: string;
  }
  
  export class SortDto {
    @ApiPropertyOptional({ description: 'Field to sort by' })
    @IsString()
    field: string;
  
    @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.ASC })
    @IsEnum(SortDirection)
    direction: SortDirection = SortDirection.ASC;
  
    @ApiPropertyOptional({ description: 'Relation path for nested sorting' })
    @IsOptional()
    @IsString()
    relation?: string;
  
    @ApiPropertyOptional({ description: 'Handle null values first' })
    @IsOptional()
    @IsBoolean()
    nullsFirst?: boolean;
  }
  
  export class PaginationQueryDto {
    @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
  
    @ApiPropertyOptional({ minimum: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;
  
    @ApiPropertyOptional({ description: 'Search term for full-text search' })
    @IsOptional()
    @IsString()
    search?: string;
  
    @ApiPropertyOptional({ 
      type: [String], 
      description: 'Fields to search in (comma-separated)' 
    })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(field => field.trim());
      }
      return value;
    })
    @IsArray()
    @IsString({ each: true })
    searchFields?: string[];
  
    @ApiPropertyOptional({ description: 'Field to sort by' })
    @IsOptional()
    @IsString()
    sortBy?: string;
  
    @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.ASC })
    @IsOptional()
    @IsEnum(SortDirection)
    sortOrder?: SortDirection = SortDirection.ASC;
  
    @ApiPropertyOptional({ 
      type: [String], 
      description: 'Relations to include (comma-separated)' 
    })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(rel => rel.trim());
      }
      return value;
    })
    @IsArray()
    @IsString({ each: true })
    relations?: string[];
  
    @ApiPropertyOptional({ 
      type: [String], 
      description: 'Fields to select (comma-separated)' 
    })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(field => field.trim());
      }
      return value;
    })
    @IsArray()
    @IsString({ each: true })
    select?: string[];
  
    @ApiPropertyOptional({ description: 'Filters in JSON format' })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return value;
    })
    @IsObject()
    filters?: Record<string, any>;
  
    @ApiPropertyOptional({ description: 'Advanced sort configuration in JSON format' })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      }
      return value;
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SortDto)
    sorts?: SortDto[];
  }
  
  export class CursorPaginationQueryDto {
    @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    first?: number;
  
    @ApiPropertyOptional({ description: 'Cursor for forward pagination' })
    @IsOptional()
    @IsString()
    after?: string;
  
    @ApiPropertyOptional({ minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    last?: number;
  
    @ApiPropertyOptional({ description: 'Cursor for backward pagination' })
    @IsOptional()
    @IsString()
    before?: string;
  
    @ApiPropertyOptional({ description: 'Field to sort by (required for cursor pagination)' })
    @IsString()
    sortBy: string;
  
    @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.ASC })
    @IsOptional()
    @IsEnum(SortDirection)
    sortOrder?: SortDirection = SortDirection.ASC;
  
    @ApiPropertyOptional({ description: 'Search term' })
    @IsOptional()
    @IsString()
    search?: string;
  
    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(field => field.trim());
      }
      return value;
    })
    @IsArray()
    @IsString({ each: true })
    searchFields?: string[];
  
    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(rel => rel.trim());
      }
      return value;
    })
    @IsArray()
    @IsString({ each: true })
    relations?: string[];
  
    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(field => field.trim());
      }
      return value;
    })
    @IsArray()
    @IsString({ each: true })
    select?: string[];
  
    @ApiPropertyOptional({ description: 'Filters in JSON format' })
    @IsOptional()
    @Transform(({ value }) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return value;
    })
    @IsObject()
    filters?: Record<string, any>;
  }