import { Injectable, Logger } from '@nestjs/common';
import { searchConfig } from './config/search.config';

@Injectable()
export class SearchCacheService {
  private readonly logger = new Logger(SearchCacheService.name);
  private cache = new Map<string, { data: any; timestamp: number }>();

  generateCacheKey(searchQuery: any): string {
    return `search:${JSON.stringify(searchQuery)}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > searchConfig.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    this.logger.debug(`Cache hit for key: ${key}`);
    return cached.data;
  }

  async set(key: string, data: any): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    this.logger.debug(`Cached data for key: ${key}`);
    
    // Simple cleanup - remove old entries if cache gets too large
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > searchConfig.cacheTimeout) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    this.logger.debug(`Cleaned up ${removed} expired cache entries`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('Search cache cleared');
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxAge: searchConfig.cacheTimeout,
    };
  }
}
