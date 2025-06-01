import { Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class LifecycleCacheService {
  private readonly logger = new Logger(LifecycleCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}:`, error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete failed for key ${key}:`, error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Implementation depends on cache provider
      // This is a placeholder for pattern-based invalidation
      this.logger.debug(`Invalidating cache pattern: ${pattern}`);
    } catch (error) {
      this.logger.warn(`Cache pattern invalidation failed for ${pattern}:`, error);
    }
  }

  generateEntityCacheKey(entityType: string, entityId: string): string {
    return `entity:${entityType}:${entityId}`;
  }

  generateVersionCacheKey(entityType: string, entityId: string, version: number): string {
    return `version:${entityType}:${entityId}:${version}`;
  }

  generateAuditCacheKey(entityType: string, entityId: string): string {
    return `audit:${entityType}:${entityId}`;
  }
}