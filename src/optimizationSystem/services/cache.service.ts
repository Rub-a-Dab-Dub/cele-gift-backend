import { Injectable, Logger } from '@nestjs/common';
import { CacheEntry } from '../interfaces/performance.interface';

@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set<T>(key: string, value: T, ttl: number = 300, tags: string[] = []): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      ttl: ttl * 1000, // Convert to milliseconds
      tags,
      createdAt: new Date(),
      lastAccessed: new Date(),
      hitCount: 0,
    };

    this.cache.set(key, entry);

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      return null;
    }

    // Update access stats
    entry.lastAccessed = new Date();
    entry.hitCount++;

    return entry.value as T;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    return this.cache.delete(key);
  }

  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    
    if (!keys) {
      return 0;
    }

    let deletedCount = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  invalidateByTags(tags: string[]): number {
    let totalDeleted = 0;
    for (const tag of tags) {
      totalDeleted += this.invalidateByTag(tag);
    }
    return totalDeleted;
  }

  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    const totalEntries = entries.length;
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const avgHitCount = totalEntries > 0 ? totalHits / totalEntries : 0;

    return {
      totalEntries,
      totalHits,
      avgHitCount,
      memoryUsage: this.estimateMemoryUsage(),
      tags: this.tagIndex.size,
    };
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt.getTime() > entry.ttl;
  }

  private cleanup(): void {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.value).length;
    }
    
    return totalSize;
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}