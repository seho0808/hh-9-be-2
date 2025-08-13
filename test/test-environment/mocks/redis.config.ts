import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { StartedRedisContainer } from "@testcontainers/redis";
import { RedisManager } from "../../../src/common/infrastructure/config/redis.config";

@Injectable()
export class TestRedisConfig extends RedisManager {
  private readonly testRedis: Redis;

  constructor(redisContainer: StartedRedisContainer) {
    super();
    this.testRedis = new Redis({
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  getClient(): Redis {
    return this.testRedis;
  }

  async disconnect(): Promise<void> {
    this.testRedis.disconnect();
  }
}
