export interface PaginationOptions {
    limit?: number;
    page?: number;
    cursor?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    filters?: Record<string, any>;
    relations?: string[];
    select?: string[];
    search?: string;
    searchFields?: string[];
  }
  
  export interface CursorPaginationOptions {
    first?: number;
    after?: string;
    last?: number;
    before?: string;
    sortBy: string;
    sortOrder?: 'ASC' | 'DESC';
    filters?: Record<string, any>;
    relations?: string[];
    select?: string[];
  }
  
  export interface PaginationMetadata {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    queryTime: number;
    cacheHit: boolean;
  }
  
  export interface CursorPaginationMetadata {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
    totalCount?: number;
    queryTime: number;
    cacheHit: boolean;
  }
  
  export interface PaginatedResult<T> {
    data: T[];
    metadata: PaginationMetadata;
  }
  
  export interface CursorPaginatedResult<T> {
    edges: Array<{
      node: T;
      cursor: string;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string;
      endCursor?: string;
    };
    totalCount?: number;
    metadata: CursorPaginationMetadata;
  }
  
  export interface FilterConfig {
    field: string;
    operator: FilterOperator;
    value: any;
    relation?: string;
    transform?: (value: any) => any;
  }
  
  export enum FilterOperator {
    EQUALS = 'eq',
    NOT_EQUALS = 'neq',
    GREATER_THAN = 'gt',
    GREATER_THAN_OR_EQUAL = 'gte',
    LESS_THAN = 'lt',
    LESS_THAN_OR_EQUAL = 'lte',
    LIKE = 'like',
    ILIKE = 'ilike',
    IN = 'in',
    NOT_IN = 'not_in',
    IS_NULL = 'is_null',
    IS_NOT_NULL = 'is_not_null',
    BETWEEN = 'between',
    ARRAY_CONTAINS = 'array_contains',
    ARRAY_OVERLAP = 'array_overlap',
    JSON_CONTAINS = 'json_contains',
  }
  
  export enum SortDirection {
    ASC = 'ASC',
    DESC = 'DESC',
  }
  
  export interface SortConfig {
    field: string;
    direction: SortDirection;
    relation?: string;
    nullsFirst?: boolean;
  }
  
  export interface TransformOptions {
    exclude?: string[];
    include?: string[];
    transform?: Record<string, (value: any) => any>;
    nested?: Record<string, TransformOptions>;
  }