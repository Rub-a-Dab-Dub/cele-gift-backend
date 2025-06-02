export enum PaginationType {
    OFFSET = 'offset',
    CURSOR = 'cursor',
    HYBRID = 'hybrid',
  }
  
  export enum CacheStrategy {
    NONE = 'none',
    MEMORY = 'memory',
    REDIS = 'redis',
    HYBRID = 'hybrid',
  }
  
  export enum SortNulls {
    FIRST = 'NULLS FIRST',
    LAST = 'NULLS LAST',
  }