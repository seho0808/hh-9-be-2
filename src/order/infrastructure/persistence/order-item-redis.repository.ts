import { RedisManager } from "@/common/infrastructure/config/redis.config";
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import {
  PopularProductResult,
  PopularProductsQueryPort,
} from "@/order/application/ports/popular-products.port";

@Injectable()
export class OrderItemRedisRepository implements PopularProductsQueryPort {
  private readonly redis: Redis;

  constructor(private readonly redisManager: RedisManager) {
    this.redis = this.redisManager.getClient();
  }

  private readonly rollupDays = 3;
  private readonly rollupKeyPrefix = "popular_products:rollup";

  async findPopularProducts(limit: number): Promise<PopularProductResult[]> {
    const flat = await this.redis.zrevrange(
      this.fullRollupKey(),
      0,
      limit - 1,
      "WITHSCORES"
    );

    const result: { productId: string; totalQuantity: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const productId = flat[i];
      const quantity = flat[i + 1];
      result.push({ productId, totalQuantity: parseInt(quantity, 10) });
    }
    return result;
  }

  async updatePopularProducts(
    productId: string,
    quantityToAdd: number
  ): Promise<void> {
    await this.redis.zincrby(this.todayKey(), quantityToAdd, productId);
    await this.redis.zincrby(this.fullRollupKey(), quantityToAdd, productId);
  }

  async midnightRollOver(): Promise<void> {
    await this.latestDayRollup(); // 오늘 데이터를 어제로 이동
    await this.oldestDayRollup(); // 오래된 데이터를 fullRollup에서 제거
  }

  // day:today -> day:2022-02-22 로 변경
  async latestDayRollup(): Promise<void> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const exists = await this.redis.exists(this.todayKey());
    if (!exists) {
      return;
    }
    await this.redis.rename(this.todayKey(), this.dateKey(yesterday));
    await this.redis.expire(
      this.dateKey(yesterday),
      24 * 60 * 60 * (this.rollupDays + 1)
    );
  }

  async oldestDayRollup(): Promise<void> {
    await this.redis.zunionstore(
      `${this.fullRollupKey()}:tmp`, // destination
      2, // numkeys
      `${this.fullRollupKey()}`,
      `${this.oldestDayKey()}`,
      "WEIGHTS",
      1,
      -1,
      "AGGREGATE",
      "SUM"
    );

    await this.redis.rename(
      `${this.fullRollupKey()}:tmp`,
      `${this.fullRollupKey()}`
    );
  }

  private todayKey(): string {
    return `${this.rollupKeyPrefix}:today`;
  }

  private fullRollupKey(): string {
    return `${this.rollupKeyPrefix}:${this.rollupDays}day`;
  }

  private oldestDayKey(): string {
    const now = new Date();
    const oldestDay = new Date(
      now.getTime() - 24 * 60 * 60 * 1000 * this.rollupDays
    );
    return `${this.rollupKeyPrefix}:${oldestDay.toISOString().split("T")[0].replace(/-/g, "")}`;
  }

  private dateKey(date: Date): string {
    return `${this.rollupKeyPrefix}:${date.toISOString().split("T")[0].replace(/-/g, "")}`;
  }
}
