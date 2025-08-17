import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { RedisManager } from "../config/redis.config";
import { LockService, LockOptions } from "./lock.interfaces";
import { SpinLockTimeoutError } from "../infrastructure.exceptions";

/**
 * PubSub 메커니즘을 사용한 분산 락 서비스
 */
@Injectable()
export class PubSubLockService implements LockService {
  private readonly redis: Redis;
  private readonly defaultTtl: number = 5000; // 5초
  private readonly defaultTimeout: number = 10000; // 10초

  constructor(private readonly redisManager: RedisManager) {
    this.redis = this.redisManager.getClient();
  }

  /**
   * 분산 락을 획득하고 함수를 실행
   */
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T> {
    const ttl = options?.ttl || this.defaultTtl;
    const timeout = options?.timeout || this.defaultTimeout;
    const lockValue = this.generateLockValue();

    const acquired = await this.acquireLockWithPubSub(
      lockKey,
      lockValue,
      ttl,
      timeout
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

  /**
   * PubSub로 락 획득
   */
  private async acquireLockWithPubSub(
    lockKey: string,
    lockValue: string,
    ttl: number,
    timeout: number
  ): Promise<boolean> {
    // 즉시 락 획득 시도
    if (await this.acquireLock(lockKey, lockValue, ttl)) {
      return true;
    }

    // PubSub으로 락 해제 대기
    const channelKey = this.getChannelKey(lockKey);
    const subscriber = this.redis.duplicate();

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const startTime = Date.now();

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          subscriber.disconnect();
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeout);

      subscriber.subscribe(channelKey);

      // 폴링 메커니즘을 추가하여 PubSub 실패를 대비
      const pollInterval = setInterval(async () => {
        if (resolved) {
          clearInterval(pollInterval);
          return;
        }

        // 타임아웃 체크
        if (Date.now() - startTime >= timeout) {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
          cleanup();
          resolve(false);
          return;
        }

        // 락 획득 시도
        const acquired = await this.acquireLock(lockKey, lockValue, ttl);
        if (acquired) {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
          cleanup();
          resolve(true);
        }
      }, 10); // 10ms마다 폴링

      subscriber.on("message", async (channel, message) => {
        if (resolved) return;

        if (channel === channelKey && message === "released") {
          const acquired = await this.acquireLock(lockKey, lockValue, ttl);
          if (acquired) {
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            cleanup();
            resolve(true);
          }
        }
      });

      // 연결 에러 처리
      subscriber.on("error", (err) => {
        console.warn("PubSub subscriber error:", err);
        // 에러가 발생해도 폴링으로 계속 시도
      });
    });
  }

  /**
   * 락 획득 시도
   */
  private async acquireLock(
    lockKey: string,
    lockValue: string,
    ttl: number
  ): Promise<boolean> {
    const result = await this.redis.set(lockKey, lockValue, "PX", ttl, "NX");
    return result === "OK";
  }

  /**
   * 락 해제 및 알림
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    const channelKey = this.getChannelKey(lockKey);

    const releaseScript = `
      local lockKey = KEYS[1]
      local channelKey = KEYS[2]
      local expected = ARGV[1]
      local current = redis.call("GET", lockKey)
      if current and current == expected then
        redis.call("DEL", lockKey)
        redis.call("PUBLISH", channelKey, "released")
        return 1
      end
      return 0
    `;

    await this.redis.eval(releaseScript, 2, lockKey, channelKey, lockValue);
  }

  /**
   * 채널 키 생성
   */
  private getChannelKey(lockKey: string): string {
    return `${lockKey}:channel`;
  }

  /**
   * 고유한 락 값 생성
   */
  private generateLockValue(): string {
    return `${Date.now()}-${Math.random()}`;
  }
}
