import { SetMetadata } from '@nestjs/common';

export const PERFORMANCE_MONITOR_KEY = 'performance:monitor';
export const CACHE_KEY = 'cache:key';
export const CACHE_TTL_KEY = 'cache:ttl';
export const CACHE_TAGS_KEY = 'cache:tags';

export const MonitorPerformance = (options?: {
  name?: string;
  threshold?: number;
  includeParams?: boolean;
}) => SetMetadata(PERFORMANCE_MONITOR_KEY, options || {});

export const Cache = (ttl: number = 300, tags: string[] = []) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_TTL_KEY, ttl)(target, propertyName, descriptor);
    SetMetadata(CACHE_TAGS_KEY, tags)(target, propertyName, descriptor);
  };
};