import { Injectable, Logger } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { CACHE_KEYS } from "./cache-keys.constants";

@Injectable()
export class CacheInvalidationService {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * 새 주문 생성 시 사용자 주문 캐시 무효화
   */
  async invalidateUserOrdersCache(userId: string): Promise<void> {
    try {
      await this.cacheService.delPattern(CACHE_KEYS.USER_ORDERS(userId));
      await this.cacheService.del(CACHE_KEYS.USER_ORDERS_LAST_UPDATED(userId));
    } catch (error) {}
  }

  /**
   * 상품 정보 수정 시 상품 캐시 무효화
   */
  async invalidateProductCache(productId: string): Promise<void> {
    try {
      await this.cacheService.del(CACHE_KEYS.PRODUCT_DETAILS(productId));
    } catch (error) {}
  }

  /**
   * 여러 상품 캐시 일괄 무효화
   */
  async invalidateMultipleProductsCache(productIds: string[]): Promise<void> {
    try {
      const keys = productIds.map((id) => CACHE_KEYS.PRODUCT_DETAILS(id));
      await Promise.all(keys.map((key) => this.cacheService.del(key)));
    } catch (error) {}
  }

  /**
   * 주문 상태 변경 시 사용자 주문 캐시 무효화
   */
  async invalidateUserOrdersCacheOnStatusChange(
    userId: string,
    orderId: string
  ): Promise<void> {
    try {
      await this.invalidateUserOrdersCache(userId);
    } catch (error) {}
  }

  /**
   * 강제 캐시 무효화 API (관리자용)
   */
  async forceInvalidateAll(): Promise<void> {
    try {
      // 인기 상품 캐시 삭제
      await this.cacheService.del(CACHE_KEYS.POPULAR_PRODUCTS);
      await this.cacheService.del(CACHE_KEYS.POPULAR_PRODUCTS_LAST_UPDATED);

      // 사용자 주문 캐시 패턴 삭제
      await this.cacheService.delPattern("user:orders:*");

      // 상품 상세 캐시 패턴 삭제
      await this.cacheService.delPattern("product:details:*");
    } catch (error) {}
  }
}
