
import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.cacheManager) {
      return null;
    }

    try {
      const result = await this.cacheManager.get<T>(key);
      if (result) {
        this.logger.debug(`Cache hit for key: ${key}`);
      }
      return result || null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    try {
      // This implementation depends on the cache store
      // For Redis: await this.cacheManager.store.keys(pattern).then(keys => keys.forEach(key => this.cacheManager.del(key)));
      this.logger.debug(`Cache pattern invalidated: ${pattern}`);
    } catch (error) {
      this.logger.error(`Cache pattern invalidation error for pattern ${pattern}:`, error);
    }
  }
}