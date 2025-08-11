import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
@Injectable()
export class RedisConfig {
  private readonly redis: Redis;

  constructor() {
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

  async disconnect(): Promise<void> {
    this.redis.disconnect();
  }
}
