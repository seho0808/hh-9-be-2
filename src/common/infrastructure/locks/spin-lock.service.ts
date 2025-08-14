import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { RedisManager } from "../config/redis.config";
import { LockService, LockOptions } from "./lock.interfaces";
import { SpinLockTimeoutError } from "../infrastructure.exceptions";

@Injectable()
export class SpinLockService implements LockService {
  private readonly redis: Redis;
  private readonly defaultTtl: number;
  private readonly defaultTimeout: number;
  private readonly defaultMaxAttempts: number;
  private readonly defaultInitialDelay: number;
  private readonly defaultMaxDelay: number;

  constructor(private readonly redisManager: RedisManager) {
    this.redis = this.redisManager.getClient();
    this.defaultTtl = 5000;
    this.defaultTimeout = 10000;
    this.defaultMaxAttempts = 100;
    this.defaultInitialDelay = 10; // 10ms
    this.defaultMaxDelay = 1000; // 1초
  }

  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T> {
    const ttl = options?.ttl || this.defaultTtl;
    const timeout = options?.timeout || this.defaultTimeout;
    const maxAttempts = options?.maxAttempts || this.defaultMaxAttempts;
    const initialDelay = options?.initialDelay || this.defaultInitialDelay;
    const maxDelay = options?.maxDelay || this.defaultMaxDelay;

    const lockValue = this.generateLockValue();
    const acquired = await this.acquireLockWithRetry(
      lockKey,
      lockValue,
      ttl,
      timeout,
      maxAttempts,
      initialDelay,
      maxDelay
    );

    if (!acquired) {
      throw new SpinLockTimeoutError(lockKey, "락 획득 타임아웃");
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  private async acquireLockWithRetry(
    lockKey: string,
    lockValue: string,
    ttl: number,
    timeout: number,
    maxAttempts: number,
    initialDelay: number,
    maxDelay: number
  ): Promise<boolean> {
    const startTime = Date.now();
    let attempts = 0;
    let delay = initialDelay;

    while (attempts < maxAttempts && Date.now() - startTime < timeout) {
      // 락 획득 시도
      const acquired = await this.acquireLock(lockKey, lockValue, ttl);
      if (acquired) {
        return true;
      }

      attempts++;

      // 타임아웃 체크
      if (Date.now() - startTime >= timeout) {
        break;
      }

      // 지수 백오프를 사용한 지연 (jitter 포함)
      const jitter = Math.random() * 0.1; // 10% jitter
      const actualDelay = Math.min(delay * (1 + jitter), maxDelay);

      await this.sleep(actualDelay);

      // 다음 시도를 위한 지연 시간 증가 (exponential backoff)
      delay = Math.min(delay * 1.5, maxDelay);
    }

    return false;
  }

  private async acquireLock(
    lockKey: string,
    lockValue: string,
    ttl: number
  ): Promise<boolean> {
    const result = await this.redis.set(lockKey, lockValue, "PX", ttl, "NX");
    return result === "OK";
  }

  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    // Lua 스크립트로 안전한 락 해제 (자신이 설정한 락만 해제)
    const luaScript = `
      local lockKey = KEYS[1]
      local lockValue = ARGV[1]
      
      local currentValue = redis.call("GET", lockKey)
      if currentValue == lockValue then
        return redis.call("DEL", lockKey)
      else
        return 0
      end
    `;

    await this.redis.eval(luaScript, 1, lockKey, lockValue);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateLockValue(): string {
    // 클라이언트 ID와 타임스탬프, 랜덤 값을 조합하여 고유한 락 값 생성
    const clientId = process.pid; // 프로세스 ID 사용
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${clientId}-${timestamp}-${random}`;
  }
}
