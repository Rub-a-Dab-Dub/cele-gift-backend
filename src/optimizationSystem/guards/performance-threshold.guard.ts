import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QueryMonitorService } from '../services/query-monitor.service';

@Injectable()
export class PerformanceThresholdGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly queryMonitor: QueryMonitorService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const threshold = this.reflector.get<number>('performance-threshold', context.getHandler());
    
    if (!threshold) {
      return true; // No threshold set, allow request
    }

    const request = context.switchToHttp().getRequest();
    const methodName = context.getHandler().name;
    const className = context.getClass().name;
    const queryId = `${className}.${methodName}`;

    const stats = this.queryMonitor.getQueryStatistics(queryId);
    
    if (stats && stats.avgExecutionTime > threshold) {
      throw new HttpException(
        `Method ${queryId} is currently performing poorly (avg: ${stats.avgExecutionTime}ms, threshold: ${threshold}ms)`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return true;
  }
}
