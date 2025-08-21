import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { StartedRedisContainer } from "@testcontainers/redis";
import { BaseRedisEvalsha } from "../../../src/common/infrastructure/config/base-redis-evalsha";

@Injectable()
export class TestRedisConfig extends BaseRedisEvalsha {
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

  protected getRedisClient(): Redis {
    return this.testRedis;
  }

  async disconnect(): Promise<void> {
    await this.testRedis.disconnect();
  }
}
