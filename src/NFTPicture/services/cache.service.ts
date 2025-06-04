// src/services/cache.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '@nestjs-modules/ioredis';

@Injectable()
export class CacheService {
  constructor(private redisService: RedisService) {}

  async get(key: string): Promise<any> {
    try {
      const value = await this.redisService.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await this.redisService.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clearNftCache(): Promise<void> {
    try {
      const keys = await this.redisService.keys('nft_*');
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}