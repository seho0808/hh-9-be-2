import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { RedisManager } from "../config/redis.config";
import { LockService, LockOptions } from "./lock.interfaces";
import { SpinLockTimeoutError } from "../infrastructure.exceptions";

interface QueueItem {
  clientId: string;
  timestamp: number;
}

@Injectable()
export class QueueLockService implements LockService {
  private readonly redis: Redis;
  private readonly clientId: string;
  private readonly defaultTtl: number;
  private readonly defaultTimeout: number;

  constructor(private readonly redisManager: RedisManager) {
    this.redis = this.redisManager.getClient();
    this.clientId = this.generateClientId();
    this.defaultTtl = 5000;
    this.defaultTimeout = 10000;
  }

  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T> {
    const ttl = options?.ttl || this.defaultTtl;
    const timeout = options?.timeout || this.defaultTimeout;
    const lockValue = this.generateLockValue();

    // 1. 첫 요청 시도
    const immediateAcquired = await this.tryAcquireLock(
      lockKey,
      lockValue,
      ttl
    );

    if (immediateAcquired) {
      try {
        return await fn();
      } finally {
        await this.releaseLock(lockKey, lockValue, ttl);
      }
    }

    // 2. 실패하면 큐에 등록하고 PubSub으로 대기
    const acquired = await this.acquireLockWithQueue(
      lockKey,
      lockValue,
      ttl,
      timeout
    );

    if (!acquired) {
      throw new SpinLockTimeoutError(lockKey, "큐 기반 락 획득 타임아웃");
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(lockKey, lockValue, ttl);
    }
  }

  /**
   * 큐에 등록하고 PubSub으로 락 해제를 기다림
   */
  private async acquireLockWithQueue(
    lockKey: string,
    lockValue: string,
    ttl: number,
    timeout: number
  ): Promise<boolean> {
    const queueKey = `${lockKey}:queue`;
    const channelKey = `${lockKey}:channel`;

    // 큐에 등록
    await this.enqueue(queueKey, this.clientId);

    // PubSub 채널 구독
    const subscriber = this.redis.duplicate();

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        subscriber.disconnect();
        // TTL로 자동 정리되므로 dequeue 불필요
        resolve(false);
      }, timeout);

      // 내 차례 알림을 기다림
      subscriber.subscribe(channelKey);

      subscriber.on("message", async (channel, message) => {
        if (channel === channelKey && message === this.clientId) {
          // 내 차례! 락 획득 시도
          const acquired = await this.tryAcquireLock(lockKey, lockValue, ttl);

          if (acquired) {
            // 락 획득 성공 - LPOP으로 이미 큐에서 제거됨
            clearTimeout(timeoutId);
            subscriber.disconnect();
            resolve(true);
          } else {
            // 락 획득 실패 - 큐 맨 뒤로 다시 등록
            console.warn(
              `Lock acquisition failed for ${this.clientId} despite notification - re-enqueuing`
            );
            await this.enqueue(queueKey, this.clientId);
          }
        }
      });
    });
  }

  /**
   * 단순 락 획득 시도
   */
  private async tryAcquireLock(
    lockKey: string,
    lockValue: string,
    ttl: number
  ): Promise<boolean> {
    const result = await this.redis.set(lockKey, lockValue, "PX", ttl, "NX");
    return result === "OK";
  }

  /**
   * 락 해제 및 다음 순번에게 알림
   */
  private async releaseLock(
    lockKey: string,
    lockValue: string,
    ttl: number
  ): Promise<void> {
    const queueKey = `${lockKey}:queue`;
    const channelKey = `${lockKey}:channel`;

    // Lua 스크립트: 락 해제 + LPOP으로 다음 대기자에게 알림
    const luaScript =
      `
      local lockKey = KEYS[1]
      local queueKey = KEYS[2]
      local channelKey = KEYS[3]
      local expected = ARGV[1]
      local now = tonumber(ARGV[2])
      
      -- 락 해제 확인 및 실행
      local current = redis.call("GET", lockKey)
      if current and current == expected then
        redis.call("DEL", lockKey)
        
        -- TTL 만료된 것들 건너뛰고 유효한 대기자 찾기
        while true do
          local nextItem = redis.call("LPOP", queueKey)
          if not nextItem then
            break
          end
          
          local data = cjson.decode(nextItem)
          -- TTL 체크
          if (now - data.timestamp) < ` +
      ttl +
      ` then
            redis.call("PUBLISH", channelKey, data.clientId)
            break
          end
        end
        
        return 1
      end
      return 0
    `;

    await this.redis.eval(
      luaScript,
      3,
      lockKey,
      queueKey,
      channelKey,
      lockValue,
      Date.now().toString()
    );
  }

  /**
   * 큐에 클라이언트 추가
   */
  private async enqueue(queueKey: string, clientId: string): Promise<void> {
    const queueItem: QueueItem = {
      clientId,
      timestamp: Date.now(),
    };

    const luaScript = `
      local queueKey = KEYS[1]
      local clientId = ARGV[1]
      local queueItemJson = ARGV[2]
      
      -- 이미 큐에 있는지 확인
      local queue = redis.call("LRANGE", queueKey, 0, -1)
      for i, item in ipairs(queue) do
        local data = cjson.decode(item)
        if data.clientId == clientId then
          return 0  -- 이미 큐에 있음
        end
      end
      
      -- 큐에 추가
      redis.call("RPUSH", queueKey, queueItemJson)
      redis.call("EXPIRE", queueKey, 300)  -- 5분 TTL
      return 1
    `;

    await this.redis.eval(
      luaScript,
      1,
      queueKey,
      clientId,
      JSON.stringify(queueItem)
    );
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLockValue(): string {
    return `${this.clientId}-${Date.now()}-${Math.random()}`;
  }
}
