import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { LockService, LockOptions } from "./lock.interfaces";
import {
  SpinLockTimeoutError,
  FencingTokenViolationError,
} from "../infrastructure.exceptions";
import { RedisManager } from "../config/redis.config";
import { PubSubLockService } from "./pubsub-lock.service";

@Injectable()
export class FencingLockService implements LockService {
  private readonly redis: Redis;
  private readonly pubSubLock: PubSubLockService;

  constructor(private readonly redisManager: RedisManager) {
    this.redis = this.redisManager.getClient();
    this.pubSubLock = new PubSubLockService(redisManager);
  }

  async withLock<T>(
    lockKey: string,
    fn: (fencingToken: number) => Promise<T>,
    options?: LockOptions
  ): Promise<T> {
    const fencingKey = `${lockKey}:fencing`;

    // fencing token 생성
    const fencingToken = await this.generateFencingToken(fencingKey);

    // PubSubLock을 사용하여 락 획득
    return await this.pubSubLock.withLock(
      lockKey,
      async () => {
        // 락 획득 후 fencing token을 락 값에 저장
        await this.storeFencingToken(lockKey, fencingToken);

        // fencing token 검증
        await this.validateFencingToken(lockKey, fencingToken);

        return await fn(fencingToken);
      },
      options
    );
  }

  async validateFencingToken(lockKey: string, token: number): Promise<void> {
    const currentToken = await this.getCurrentValidFencingToken(lockKey);
    if (currentToken !== token) {
      throw new FencingTokenViolationError(token, currentToken || -1);
    }
  }

  private async storeFencingToken(
    lockKey: string,
    fencingToken: number
  ): Promise<void> {
    const fencingValueKey = `${lockKey}:fencing_value`;
    await this.redis.set(fencingValueKey, fencingToken.toString(), "PX", 10000); // 10초 TTL
  }

  private async generateFencingToken(fencingKey: string): Promise<number> {
    const luaScript = `
      local fencingKey = KEYS[1]
      local token = redis.call("INCR", fencingKey)
      redis.call("EXPIRE", fencingKey, 3600)  -- 1시간 TTL
      return token
    `;

    return (await this.redis.eval(luaScript, 1, fencingKey)) as number;
  }

  private async getCurrentValidFencingToken(
    lockKey: string
  ): Promise<number | null> {
    const fencingValueKey = `${lockKey}:fencing_value`;
    const tokenValue = await this.redis.get(fencingValueKey);

    if (!tokenValue) {
      return null;
    }

    return parseInt(tokenValue, 10);
  }
}
