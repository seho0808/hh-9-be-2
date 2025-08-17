import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CacheService } from "@/common/infrastructure/cache/cache.service";
import {
  CACHE_KEYS,
  CACHE_TTL,
} from "@/common/infrastructure/cache/cache-keys.constants";

@Injectable()
export class RefreshPopularProductsCacheUseCase {
  constructor(private readonly cacheService: CacheService) {}

  @Cron("*/5 * * * *")
  async execute(): Promise<void> {
    try {
      const lastUpdated = await this.cacheService.get<string>(
        CACHE_KEYS.POPULAR_PRODUCTS_LAST_UPDATED
      );

      if (lastUpdated) {
        const lastUpdateTime = new Date(lastUpdated);
        const now = new Date();
        const diffMinutes =
          (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);

        // 30분 이상 된 캐시는 삭제하여 다음 요청 시 갱신되도록 함
        if (diffMinutes > 30) {
          await this.cacheService.del(CACHE_KEYS.POPULAR_PRODUCTS);
        }
      } else {
      }
    } catch (error) {}
  }

  @Cron(CronExpression.EVERY_HOUR)
  async monitorCacheStatus(): Promise<void> {
    try {
      const popularProductsExists = await this.cacheService.exists(
        CACHE_KEYS.POPULAR_PRODUCTS
      );
      if (!popularProductsExists) return;
    } catch (error) {}
  }
}
