import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QueryMonitorService } from '../services/query-monitor.service';
import { QueryCacheService } from '../services/cache.service';
import { PERFORMANCE_MONITOR_KEY, CACHE_TTL_KEY, CACHE_TAGS_KEY } from '../decorators/monitor-performance.decorator';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly queryMonitor: QueryMonitorService,
    private readonly cacheService: QueryCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const performanceOptions = this.reflector.get(PERFORMANCE_MONITOR_KEY, context.getHandler());
    const cacheTtl = this.reflector.get(CACHE_TTL_KEY, context.getHandler());
    const cacheTags = this.reflector.get(CACHE_TAGS_KEY, context.getHandler()) || [];
    
    const request = context.switchToHttp().getRequest();
    const methodName = context.getHandler().name;
    const className = context.getClass().name;
    const cacheKey = this.generateCacheKey(className, methodName, request);

    // Check cache first if caching is enabled
    if (cacheTtl) {
      const cachedResult = this.cacheService.get(cacheKey);
      if (cachedResult) {
        return new Observable(subscriber => {
          subscriber.next(cachedResult);
          subscriber.complete();
        });
      }
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap((result) => {
        const executionTime = Date.now() - startTime;

        // Record performance metrics if monitoring is enabled
        if (performanceOptions) {
          this.queryMonitor.recordQuery({
            queryId: `${className}.${methodName}`,
            sql: `${className}.${methodName}`, // In real scenario, extract actual SQL
            executionTime,
            rowsReturned: Array.isArray(result) ? result.length : 1,
            timestamp: new Date(),
            endpoint: request.url,
            userId: request.user?.id,
          });
        }

        // Cache result if caching is enabled
        if (cacheTtl && result) {
          this.cacheService.set(cacheKey, result, cacheTtl, cacheTags);
        }
      }),
    );
  }

  private generateCacheKey(className: string, methodName: string, request: any): string {
    const baseKey = `${className}.${methodName}`;
    const params = JSON.stringify(request.params || {});
    const query = JSON.stringify(request.query || {});
    const userId = request.user?.id || 'anonymous';
    
    return `${baseKey}:${userId}:${this.hash(params + query)}`;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}