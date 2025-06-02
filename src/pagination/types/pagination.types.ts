export type PaginationKey = string | number;

export type CursorValue = string | number | Date;

export type FilterValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | Array<string | number> 
  | { min: number; max: number }
  | null;

export type SortValue = string | { field: string; direction: 'ASC' | 'DESC' };

export type RelationPath = string;

export type SelectField = string;

export interface CursorInfo {
  value: CursorValue;
  operator: 'gt' | 'lt';
  field: string;
}

export interface QueryPerformanceMetrics {
  queryTime: number;
  cacheHit: boolean;
  indexesUsed: string[];
  rowsExamined: number;
  memoryUsage: number;
}
