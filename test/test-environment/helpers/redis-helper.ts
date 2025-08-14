import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { StartedRedisContainer } from "@testcontainers/redis";

@Injectable()
export class RedisHelper {
  private redis: Redis;

  constructor(private readonly redisContainer: StartedRedisContainer) {
    this.redis = new Redis({
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  async flushAll(): Promise<void> {
    await this.redis.flushall();
  }

  async disconnect(): Promise<void> {
    this.redis.disconnect();
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async getKeys(pattern = "*"): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }
}
