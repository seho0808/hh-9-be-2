import { Injectable } from "@nestjs/common";
import { RedisManager } from "@/common/infrastructure/config/redis.config";
import Redis from "ioredis";

export interface CouponIssuanceCheck {
  success: boolean;
  remainingCount: number;
  issuedCount: number;
}

/**
 * 쿠폰 발급 카운터를 Redis에서 관리하는 Repository
 * countdown 방식으로 남은 수량을 직접 관리
 */
@Injectable()
export class CouponRedisRepository {
  private readonly redis: Redis;

  constructor(private readonly redisManager: RedisManager) {
    this.redis = redisManager.getClient();
  }

  /**
   * 쿠폰 발급 가능 여부를 확인하고 남은 수량을 원자적으로 감소
   * Lua 스크립트를 사용하여 원자성 보장 (countdown 방식)
   */
  async checkAndDecrementRemainingCount(
    couponId: string,
    totalCount: number
  ): Promise<CouponIssuanceCheck> {
    const key = this.getRemainingCountKey(couponId);

    // Lua 스크립트로 원자적 처리 (countdown 방식)
    const luaScript = `
      local key = KEYS[1]
      local totalCount = tonumber(ARGV[1])
      
      -- 남은 수량 조회 (키가 없으면 totalCount로 초기화)
      local remainingCount = tonumber(redis.call('GET', key))
      if remainingCount == nil then
        remainingCount = totalCount
        redis.call('SET', key, totalCount)
        redis.call('EXPIRE', key, 2592000) -- 30일 TTL
      end
      
      -- 발급 가능 여부 확인
      if remainingCount <= 0 then
        return {0, totalCount - remainingCount, remainingCount}
      end
      
      -- 남은 수량 감소
      local newRemainingCount = redis.call('DECR', key)
      local issuedCount = totalCount - newRemainingCount
      
      return {1, issuedCount, newRemainingCount}
    `;

    try {
      const result = (await this.redisManager.evalsha(
        luaScript,
        1,
        key,
        totalCount.toString()
      )) as [number, number, number];

      const [success, issuedCount, remainingCount] = result;

      return {
        success: success === 1,
        issuedCount,
        remainingCount,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 쿠폰 발급 실패 시 롤백 (남은 수량 증가)
   */
  async rollbackRemainingCount(couponId: string): Promise<void> {
    const key = this.getRemainingCountKey(couponId);

    try {
      const remainingCount = await this.redis.get(key);
      if (remainingCount !== null) {
        await this.redis.incr(key);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 남은 수량 조회
   */
  async getRemainingCount(couponId: string): Promise<number> {
    const key = this.getRemainingCountKey(couponId);

    try {
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 쿠폰 남은 수량 초기화 (관리자용)
   */
  async initializeRemainingCount(
    couponId: string,
    totalCount: number
  ): Promise<void> {
    const key = this.getRemainingCountKey(couponId);

    try {
      await this.redis.set(key, totalCount);
      await this.redis.expire(key, 2592000); // 30일 TTL
    } catch (error) {
      throw error;
    }
  }

  /**
   * 쿠폰 카운터 삭제 (관리자용)
   */
  async deleteRemainingCount(couponId: string): Promise<void> {
    const key = this.getRemainingCountKey(couponId);

    try {
      await this.redis.del(key);
    } catch (error) {
      throw error;
    }
  }

  private getRemainingCountKey(couponId: string): string {
    return `coupon:remaining_count:${couponId}`;
  }
}
