import { SetMetadata } from '@nestjs/common';
import { PaginationType, CacheStrategy } from '../enums/pagination.enum';

export const PAGINATION_KEY = 'pagination';

export interface PaginationDecoratorOptions {
  type?: PaginationType;
  defaultLimit?: number;
  maxLimit?: number;
  cache?: CacheStrategy;
  cacheTTL?: number;
  allowedSortFields?: string[];
  allowedFilterFields?: string[];
  defaultSort?: { field: string; direction: 'ASC' | 'DESC' };
}

export const Paginate = (options?: PaginationDecoratorOptions) =>
  SetMetadata(PAGINATION_KEY, {
    type: PaginationType.OFFSET,
    defaultLimit: 20,
    maxLimit: 100,
    cache: CacheStrategy.MEMORY,
    cacheTTL: 300,
    ...options,
  });

export const CursorPaginate = (options?: Omit<PaginationDecoratorOptions, 'type'>) =>
  Paginate({ ...options, type: PaginationType.CURSOR });

export const HybridPaginate = (options?: Omit<PaginationDecoratorOptions, 'type'>) =>
  Paginate({ ...options, type: PaginationType.HYBRID });