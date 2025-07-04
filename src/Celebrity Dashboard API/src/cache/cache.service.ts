import { Injectable, Logger } from "@nestjs/common"
import type Redis from "ioredis"

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error)
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      this.logger.error(`Cache pattern invalidation error for ${pattern}:`, error)
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys)
      return values.map((value) => (value ? JSON.parse(value) : null))
    } catch (error) {
      this.logger.error("Cache mget error:", error)
      return keys.map(() => null)
    }
  }

  async mset(keyValuePairs: Record<string, any>, ttlSeconds = 300): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()

      Object.entries(keyValuePairs).forEach(([key, value]) => {
        pipeline.setex(key, ttlSeconds, JSON.stringify(value))
      })

      await pipeline.exec()
    } catch (error) {
      this.logger.error("Cache mset error:", error)
    }
  }
}
