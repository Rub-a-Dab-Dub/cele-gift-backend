import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class CacheService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: any,
  ) {}

  async get(key: string): Promise<any> {
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      await this.redisClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(pattern: string): Promise<void> {
    try {
      if (pattern.includes('*')) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } else {
        await this.redisClient.del(pattern);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    await this.del(pattern);
  }
}
