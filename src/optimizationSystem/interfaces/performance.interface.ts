export interface QueryPerformanceMetrics {
  queryId: string;
  sql: string;
  executionTime: number;
  rowsReturned: number;
  timestamp: Date;
  parameters?: any[];
  callStack?: string;
  userId?: string;
  endpoint?: string;
}

export interface QueryPlan {
  query: string;
  plan: any;
  cost: number;
  actualTime?: number;
  planningTime?: number;
  executionTime?: number;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImprovement: number;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  tags: string[];
  createdAt: Date;
  lastAccessed: Date;
  hitCount: number;
}

export interface PerformanceReport {
  period: { start: Date; end: Date };
  totalQueries: number;
  avgExecutionTime: number;
  slowQueries: QueryPerformanceMetrics[];
  indexSuggestions: IndexSuggestion[];
  cacheHitRate: number;
  regressions: PerformanceRegression[];
}

export interface PerformanceRegression {
  queryId: string;
  previousAvgTime: number;
  currentAvgTime: number;
  degradationPercent: number;
  detectedAt: Date;
}