import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { RedisManager } from "../config/redis.config";

@Injectable()
export class CacheService {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisManager: RedisManager) {
    this.redis = redisManager.getClient();
  }

  /**
   * 캐시에서 데이터 조회
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장 (TTL 포함)
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * 캐시 삭제
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * 여러 키 삭제 (패턴 기반)
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(
        `Cache delete pattern error for pattern ${pattern}:`,
        error
      );
    }
  }

  /**
   * 원자적 캐시 업데이트 (Pipeline 사용)
   */
  async setMultiple(
    entries: Array<{ key: string; value: any; ttl: number }>
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      entries.forEach(({ key, value, ttl }) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Cache setMultiple error:`, error);
    }
  }

  /**
   * 캐시 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }
}
