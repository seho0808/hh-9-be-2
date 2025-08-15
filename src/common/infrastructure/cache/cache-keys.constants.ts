/**
 * 캐시 키 상수 정의
 */
export const CACHE_KEYS = {
  // 인기 상품 통계
  POPULAR_PRODUCTS: "popular:products:top10",
  POPULAR_PRODUCTS_LAST_UPDATED: "popular:products:last_updated",

  // 사용자 주문 이력
  USER_ORDERS: (userId: string) => `user:orders:${userId}`,
  USER_ORDERS_LAST_UPDATED: (userId: string) =>
    `user:orders:${userId}:last_updated`,

  // 상품 상세 정보
  PRODUCT_DETAILS: (productId: string) => `product:details:${productId}`,

  // 추가 고려 대상
  USER_BALANCE: (userId: string) => `user:balance:${userId}`,
  COUPON_INFO: (couponId: string) => `coupon:info:${couponId}`,
  COUPON_LIST_ACTIVE: "coupon:list:active",
} as const;

/**
 * TTL 상수 (초 단위)
 */
export const CACHE_TTL = {
  POPULAR_PRODUCTS: 30 * 60, // 30분
  USER_ORDERS: 10 * 60, // 10분
  PRODUCT_DETAILS: 60 * 60, // 1시간
  USER_BALANCE: 5 * 60, // 5분
  COUPON_INFO: 60 * 60, // 1시간
} as const;
