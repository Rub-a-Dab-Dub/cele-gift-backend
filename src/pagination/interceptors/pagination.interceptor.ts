import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map, tap } from 'rxjs/operators';
  import { Reflector } from '@nestjs/core';
  import { PAGINATION_KEY } from '../decorators/paginate.decorator';
  import { TransformService } from '../services/transform.service';
  
  @Injectable()
  export class PaginationInterceptor implements NestInterceptor {
    private readonly logger = new Logger(PaginationInterceptor.name);
  
    constructor(
      private readonly reflector: Reflector,
      private readonly transformService: TransformService,
    ) {}
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const paginationConfig = this.reflector.getAllAndOverride(PAGINATION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
  
      if (!paginationConfig) {
        return next.handle();
      }
  
      const request = context.switchToHttp().getRequest();
      const startTime = Date.now();
  
      return next.handle().pipe(
        map((data) => {
          // Transform the response data if transformation options are provided
          if (paginationConfig.transform) {
            return this.transformService.transformPaginatedResponse(
              data,
              paginationConfig.transform,
            );
          }
          return data;
        }),
        tap(() => {
          const duration = Date.now() - startTime;
          this.logger.debug(
            `Pagination request completed: ${request.method} ${request.url} - ${duration}ms`,
          );
        }),
      );
    }
  }