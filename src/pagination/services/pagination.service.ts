import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import {
  PaginationOptions,
  CursorPaginationOptions,
  PaginatedResult,
  CursorPaginatedResult,
  FilterConfig,
  SortConfig,
  FilterOperator,
  SortDirection,
} from '../interfaces/pagination.interface';
import { CursorUtil } from '../utils/cursor.util';
import { FilterBuilder } from './filter.builder';
import { SortBuilder } from './sort.builder';
import { CacheService } from './cache.service';

@Injectable()
export class PaginationService {
  private readonly logger = new Logger(PaginationService.name);

  constructor(
    private readonly filterBuilder: FilterBuilder,
    private readonly sortBuilder: SortBuilder,
    private readonly cacheService: CacheService,
  ) {}

  async paginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: PaginationOptions,
    alias?: string,
  ): Promise<PaginatedResult<T>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('offset', options);
    
    // Try cache first
    const cached = await this.cacheService.get<PaginatedResult<T>>(cacheKey);
    if (cached) {
      cached.metadata.cacheHit = true;
      return cached;
    }

    const queryBuilder = repository.createQueryBuilder(alias || repository.metadata.tableName);
    
    // Apply filters
    if (options.filters) {
      this.filterBuilder.applyFilters(queryBuilder, options.filters, alias);
    }

    // Apply search
    if (options.search && options.searchFields) {
      this.applySearch(queryBuilder, options.search, options.searchFields, alias);
    }

    // Apply relations
    if (options.relations) {
      this.applyRelations(queryBuilder, options.relations, alias);
    }

    // Apply sorting
    if (options.sortBy) {
      this.sortBuilder.applySort(queryBuilder, {
        field: options.sortBy,
        direction: options.sortOrder || SortDirection.ASC,
      }, alias);
    }

    // Apply selection
    if (options.select) {
      this.applySelection(queryBuilder, options.select, alias);
    }

    // Get total count for metadata
    const totalItems = await queryBuilder.getCount();

    // Apply pagination
    const limit = Math.min(options.limit || 20, 100);
    const page = options.page || 1;
    const offset = (page - 1) * limit;

    queryBuilder.limit(limit).offset(offset);

    // Execute query
    const data = await queryBuilder.getMany();
    const queryTime = Date.now() - startTime;

    const result: PaginatedResult<T> = {
      data,
      metadata: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPreviousPage: page > 1,
        queryTime,
        cacheHit: false,
      },
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, 300);

    this.logger.debug(
      `Offset pagination completed: ${data.length} items, ${queryTime}ms, page ${page}/${result.metadata.totalPages}`,
    );

    return result;
  }

  async cursorPaginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: CursorPaginationOptions,
    alias?: string,
  ): Promise<CursorPaginatedResult<T>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('cursor', options);
    
    // Try cache first
    const cached = await this.cacheService.get<CursorPaginatedResult<T>>(cacheKey);
    if (cached) {
      cached.metadata.cacheHit = true;
      return cached;
    }

    const tableAlias = alias || repository.metadata.tableName;
    const queryBuilder = repository.createQueryBuilder(tableAlias);

    // Apply filters
    if (options.filters) {
      this.filterBuilder.applyFilters(queryBuilder, options.filters, tableAlias);
    }

    // Apply relations
    if (options.relations) {
      this.applyRelations(queryBuilder, options.relations, tableAlias);
    }

    // Apply selection
    if (options.select) {
      this.applySelection(queryBuilder, options.select, tableAlias);
    }

    // Apply cursor-based filtering
    await this.applyCursorConditions(queryBuilder, options, tableAlias);

    // Apply sorting (crucial for cursor pagination)
    this.sortBuilder.applySort(queryBuilder, {
      field: options.sortBy,
      direction: options.sortOrder || SortDirection.ASC,
    }, tableAlias);

    // Determine limit and fetch extra item to check for more pages
    const limit = this.determineCursorLimit(options);
    queryBuilder.limit(limit + 1);

    // Execute query
    const results = await queryBuilder.getMany();
    const queryTime = Date.now() - startTime;

    // Process results for cursor pagination
    const {
      data,
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor,
    } = this.processCursorResults(results, options, limit);

    const result: CursorPaginatedResult<T> = {
      edges: data.map(item => ({
        node: item,
        cursor: CursorUtil.createCursor(item, options.sortBy),
      })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor,
        endCursor,
      },
      metadata: {
        hasNextPage,
        hasPreviousPage,
        startCursor,
        endCursor,
        queryTime,
        cacheHit: false,
      },
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, 300);

    this.logger.debug(
      `Cursor pagination completed: ${data.length} items, ${queryTime}ms`,
    );

    return result;
  }

  private async applyCursorConditions<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: CursorPaginationOptions,
    alias: string,
  ): Promise<void> {
    const sortField = `${alias}.${options.sortBy}`;
    const sortOrder = options.sortOrder || SortDirection.ASC;

    if (options.after) {
      const cursorValue = CursorUtil.decode(options.after);
      const operator = sortOrder === SortDirection.ASC ? '>' : '<';
      queryBuilder.andWhere(`${sortField} ${operator} :afterCursor`, { 
        afterCursor: cursorValue 
      });
    }

    if (options.before) {
      const cursorValue = CursorUtil.decode(options.before);
      const operator = sortOrder === SortDirection.ASC ? '<' : '>';
      queryBuilder.andWhere(`${sortField} ${operator} :beforeCursor`, { 
        beforeCursor: cursorValue 
      });
    }
  }

  private determineCursorLimit(options: CursorPaginationOptions): number {
    if (options.first && options.last) {
      throw new BadRequestException('Cannot specify both "first" and "last"');
    }
    return Math.min(options.first || options.last || 20, 100);
  }

  private processCursorResults<T>(
    results: T[],
    options: CursorPaginationOptions,
    requestedLimit: number,
  ): {
    data: T[];
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  } {
    const hasExtraItem = results.length > requestedLimit;
    const data = hasExtraItem ? results.slice(0, requestedLimit) : results;

    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.first) {
      hasNextPage = hasExtraItem;
      hasPreviousPage = !!options.after;
    } else if (options.last) {
      hasPreviousPage = hasExtraItem;
      hasNextPage = !!options.before;
      // Reverse the data for "last" pagination
      data.reverse();
    }

    const startCursor = data.length > 0 
      ? CursorUtil.createCursor(data[0], options.sortBy) 
      : undefined;
    const endCursor = data.length > 0 
      ? CursorUtil.createCursor(data[data.length - 1], options.sortBy) 
      : undefined;

    return {
      data,
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor,
    };
  }

  private applySearch<T>(
    queryBuilder: SelectQueryBuilder<T>,
    searchTerm: string,
    searchFields: string[],
    alias?: string,
  ): void {
    if (!searchTerm || !searchFields.length) return;

    const conditions = searchFields.map((field, index) => {
      const fieldPath = alias ? `${alias}.${field}` : field;
      return `${fieldPath} ILIKE :searchTerm${index}`;
    });

    const parameters = searchFields.reduce((params, _, index) => {
      params[`searchTerm${index}`] = `%${searchTerm}%`;
      return params;
    }, {} as Record<string, any>);

    queryBuilder.andWhere(`(${conditions.join(' OR ')})`, parameters);
  }

  private applyRelations<T>(
    queryBuilder: SelectQueryBuilder<T>,
    relations: string[],
    alias?: string,
  ): void {
    relations.forEach(relation => {
      const relationPath = relation.includes('.') ? relation : relation;
      const relationAlias = relation.replace(/\./g, '_');
      
      queryBuilder.leftJoinAndSelect(
        alias ? `${alias}.${relationPath}` : relationPath,
        relationAlias,
      );
    });
  }

  private applySelection<T>(
    queryBuilder: SelectQueryBuilder<T>,
    selectFields: string[],
    alias?: string,
  ): void {
    const selections = selectFields.map(field => 
      alias ? `${alias}.${field}` : field
    );
    queryBuilder.select(selections);
  }

  private generateCacheKey(type: string, options: any): string {
    const normalized = JSON.stringify(options, Object.keys(options).sort());
    return `pagination:${type}:${Buffer.from(normalized).toString('base64')}`;
  }
}
