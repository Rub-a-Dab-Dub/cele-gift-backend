import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class PaginationMetadataDto {
  @ApiProperty({ description: 'Current page number' })
  @Expose()
  currentPage: number;

  @ApiProperty({ description: 'Number of items per page' })
  @Expose()
  itemsPerPage: number;

  @ApiProperty({ description: 'Total number of items' })
  @Expose()
  totalItems: number;

  @ApiProperty({ description: 'Total number of pages' })
  @Expose()
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  @Expose()
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  @Expose()
  hasPreviousPage: boolean;

  @ApiProperty({ description: 'Query execution time in milliseconds' })
  @Expose()
  queryTime: number;

  @ApiProperty({ description: 'Whether the result was served from cache' })
  @Expose()
  cacheHit: boolean;
}

export class CursorPageInfoDto {
  @ApiProperty({ description: 'Whether there is a next page' })
  @Expose()
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  @Expose()
  hasPreviousPage: boolean;

  @ApiPropertyOptional({ description: 'Start cursor of the current page' })
  @Expose()
  startCursor?: string;

  @ApiPropertyOptional({ description: 'End cursor of the current page' })
  @Expose()
  endCursor?: string;
}

export class CursorPaginationMetadataDto {
  @ApiProperty({ description: 'Whether there is a next page' })
  @Expose()
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  @Expose()
  hasPreviousPage: boolean;

  @ApiPropertyOptional({ description: 'Start cursor' })
  @Expose()
  startCursor?: string;

  @ApiPropertyOptional({ description: 'End cursor' })
  @Expose()
  endCursor?: string;

  @ApiPropertyOptional({ description: 'Total count (expensive operation)' })
  @Expose()
  totalCount?: number;

  @ApiProperty({ description: 'Query execution time in milliseconds' })
  @Expose()
  queryTime: number;

  @ApiProperty({ description: 'Whether the result was served from cache' })
  @Expose()
  cacheHit: boolean;
}

export function createPaginatedResponseDto<T>(dataType: new () => T) {
  class PaginatedResponseDto {
    @ApiProperty({ type: [dataType], description: 'Paginated data' })
    @Expose()
    @Type(() => dataType)
    data: T[];

    @ApiProperty({ type: PaginationMetadataDto, description: 'Pagination metadata' })
    @Expose()
    @Type(() => PaginationMetadataDto)
    metadata: PaginationMetadataDto;
  }

  return PaginatedResponseDto;
}

export function createCursorPaginatedResponseDto<T>(dataType: new () => T) {
  class EdgeDto {
    @ApiProperty({ type: dataType, description: 'Node data' })
    @Expose()
    @Type(() => dataType)
    node: T;

    @ApiProperty({ description: 'Cursor for this node' })
    @Expose()
    cursor: string;
  }

  class CursorPaginatedResponseDto {
    @ApiProperty({ type: [EdgeDto], description: 'Paginated edges' })
    @Expose()
    @Type(() => EdgeDto)
    edges: EdgeDto[];

    @ApiProperty({ type: CursorPageInfoDto, description: 'Page information' })
    @Expose()
    @Type(() => CursorPageInfoDto)
    pageInfo: CursorPageInfoDto;

    @ApiPropertyOptional({ description: 'Total count (if requested)' })
    @Expose()
    totalCount?: number;

    @ApiProperty({ type: CursorPaginationMetadataDto, description: 'Pagination metadata' })
    @Expose()
    @Type(() => CursorPaginationMetadataDto)
    metadata: CursorPaginationMetadataDto;
  }

  return CursorPaginatedResponseDto;
}