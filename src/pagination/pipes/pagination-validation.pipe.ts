import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    BadRequestException,
  } from '@nestjs/common';
  import { CursorUtil } from '../utils/cursor.util';
  import { PaginationQueryDto, CursorPaginationQueryDto } from '../dto/pagination.dto';
  
  @Injectable()
  export class PaginationValidationPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
      if (metadata.type !== 'query') {
        return value;
      }
  
      // Validate cursor pagination
      if (this.isCursorPaginationQuery(value)) {
        return this.validateCursorPagination(value);
      }
  
      // Validate offset pagination
      if (this.isOffsetPaginationQuery(value)) {
        return this.validateOffsetPagination(value);
      }
  
      return value;
    }
  
    private isCursorPaginationQuery(value: any): value is CursorPaginationQueryDto {
      return value && (value.after || value.before || value.first || value.last);
    }
  
    private isOffsetPaginationQuery(value: any): value is PaginationQueryDto {
      return value && (value.page !== undefined || value.limit !== undefined);
    }
  
    private validateCursorPagination(query: CursorPaginationQueryDto): CursorPaginationQueryDto {
      // Validate cursors
      if (query.after && !CursorUtil.isValidCursor(query.after)) {
        throw new BadRequestException('Invalid "after" cursor format');
      }
  
      if (query.before && !CursorUtil.isValidCursor(query.before)) {
        throw new BadRequestException('Invalid "before" cursor format');
      }
  
      // Validate pagination parameters
      if (query.first && query.last) {
        throw new BadRequestException('Cannot specify both "first" and "last"');
      }
  
      if (query.after && query.before) {
        throw new BadRequestException('Cannot specify both "after" and "before"');
      }
  
      if (!query.sortBy) {
        throw new BadRequestException('sortBy is required for cursor pagination');
      }
  
      // Validate limits
      if (query.first && (query.first < 1 || query.first > 100)) {
        throw new BadRequestException('first must be between 1 and 100');
      }
  
      if (query.last && (query.last < 1 || query.last > 100)) {
        throw new BadRequestException('last must be between 1 and 100');
      }
  
      return query;
    }
  
    private validateOffsetPagination(query: PaginationQueryDto): PaginationQueryDto {
      // Validate page
      if (query.page && query.page < 1) {
        throw new BadRequestException('page must be greater than 0');
      }
  
      // Validate limit
      if (query.limit && (query.limit < 1 || query.limit > 100)) {
        throw new BadRequestException('limit must be between 1 and 100');
      }
  
      // Validate filters format
      if (query.filters && typeof query.filters !== 'object') {
        throw new BadRequestException('filters must be a valid JSON object');
      }
  
      // Validate sorts format
      if (query.sorts && !Array.isArray(query.sorts)) {
        throw new BadRequestException('sorts must be an array');
      }
  
      return query;
    }
  }