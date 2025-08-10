import { Injectable } from "@nestjs/common";
import Redlock from "redlock";
import { RedisConfig } from "../config/redis.config";
import { LockService, LockOptions } from "./lock.interfaces";
import { SpinLockTimeoutError } from "../infrastructure.exceptions";

@Injectable()
export class SpinLockService implements LockService {
  private readonly redlock: Redlock;
  private readonly defaultTtl: number;

  constructor(private readonly redisConfig: RedisConfig) {
    this.defaultTtl = 5000;

    this.redlock = new Redlock([this.redisConfig.getClient()], {
      retryDelay: 50,
      retryCount: 10,
      retryJitter: 50,
    });
  }

  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T> {
    const ttl = options?.ttl || this.defaultTtl;

    try {
      return await this.redlock.using([lockKey], ttl, fn);
    } catch (error) {
      throw new SpinLockTimeoutError(lockKey, error.message);
    }
  }
}
