import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { BaseRedisEvalsha } from "./base-redis-evalsha";

@Injectable()
export class RedisManager extends BaseRedisEvalsha {
  private readonly redis: Redis;

  constructor() {
    super();
    this.redis = new Redis({
      host: "localhost",
      port: 6379,
      password: undefined,
      db: 0,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  protected getRedisClient(): Redis {
    return this.redis;
  }

  async disconnect(): Promise<void> {
    this.redis.disconnect();
  }
}
