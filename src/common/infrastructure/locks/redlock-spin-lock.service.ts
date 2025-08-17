import { Injectable } from "@nestjs/common";
import Redlock, { ExecutionError } from "redlock";
import { RedisManager } from "../config/redis.config";
import { LockService, LockOptions } from "./lock.interfaces";
import { SpinLockTimeoutError } from "../infrastructure.exceptions";

@Injectable()
export class RedlockSpinLockService implements LockService {
  private readonly redlock: Redlock;
  private readonly defaultTtl: number;

  constructor(private readonly redisManager: RedisManager) {
    this.defaultTtl = 5000;

    this.redlock = new Redlock([this.redisManager.getClient()], {
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
      if (error instanceof ExecutionError) {
        throw new SpinLockTimeoutError(lockKey, error.message);
      }
      throw error;
    }
  }
}
