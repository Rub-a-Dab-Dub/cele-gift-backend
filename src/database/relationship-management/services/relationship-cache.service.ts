import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'redis';
import { IRelationshipCache, RelationshipCacheConfig } from '../interfaces/relationship-management.interface';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@Injectable()
export class RelationshipCacheService implements IRelationshipCache {
  private readonly logger = new Logger(RelationshipCacheService.name);
  private redis: Redis.RedisClientType;
  private metrics = {
    hits: 0,
    misses: 0,
    size: 0,
  };

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redis = Redis.createClient({
        url: this.configService.get('REDIS_URL') || 'redis://localhost:6379',
      });

      this.redis.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
      });

      this.redis.on('connect', () => {
        this.logger.log('Connected to Redis for relationship caching');
      });

      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.redis.get(key);
      
      if (!cachedData) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      
      // Check if data is compressed (starts with gzip magic number)
      const isCompressed = cachedData.startsWith('H4sI') || cachedData.startsWith('1f8b');
      
      if (isCompressed) {
        const buffer = Buffer.from(cachedData, 'base64');
        const decompressed = await gunzip(buffer);
        return JSON.parse(decompressed.toString());
      }

      return JSON.parse(cachedData);
    } catch (error) {
      this.logger.error(`Error getting cached data for key ${key}:`, error);
      this.metrics.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      let serializedData = JSON.stringify(value);
      
      // Compress if data is large (> 1KB)
      if (serializedData.length > 1024) {
        const compressed = await gzip(Buffer.from(serializedData));
        serializedData = compressed.toString('base64');
      }

      if (ttl) {
        await this.redis.setEx(key, ttl, serializedData);
      } else {
        await this.redis.set(key, serializedData);
      }

      this.metrics.size++;
    } catch (error) {
      this.logger.error(`Error setting cached data for key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const deleted = await this.redis.del(key);
      if (deleted > 0) {
        this.metrics.size = Math.max(0, this.metrics.size - 1);
      }
    } catch (error) {
      this.logger.error(`Error deleting cached data for key ${key}:`, error);
      throw error;
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
          this.metrics.size = Math.max(0, this.metrics.size - keys.length);
        }
      } else {
        await this.redis.flushDb();
        this.metrics.size = 0;
      }
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
      throw error;
    }
  }

  async getMetrics(): Promise<{ hits: number; misses: number; size: number }> {
    try {
      // Get actual size from Redis
      const info = await this.redis.info('keyspace');
      const dbMatch = info.match(/db0:keys=(\d+)/);
      const actualSize = dbMatch ? parseInt(dbMatch[1]) : 0;
      
      return {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        size: actualSize,
      };
    } catch (error) {
      this.logger.error('Error getting cache metrics:', error);
      return this.metrics;
    }
  }

  generateCacheKey(entityName: string, entityId: string, relationName?: string): string {
    const baseKey = `relationship:${entityName}:${entityId}`;
    return relationName ? `${baseKey}:${relationName}` : baseKey;
  }

  async warmupCache<T>(entities: T[], cacheConfig: RelationshipCacheConfig): Promise<void> {
    this.logger.log(`Warming up cache for ${entities.length} entities`);
    
    const promises = entities.map(async (entity: any) => {
      const key = this.generateCacheKey(entity.constructor.name, entity.id);
      await this.set(key, entity, cacheConfig.ttl);
    });

    await Promise.all(promises);
    this.logger.log('Cache warmup completed');
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
} 