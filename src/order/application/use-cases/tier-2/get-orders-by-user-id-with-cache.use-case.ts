import { Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { GetOrdersByUserIdUseCase } from "../tier-1-in-domain/get-orders-by-user-id.use-case";
import { CacheService } from "@/common/infrastructure/cache/cache.service";
import {
  CACHE_KEYS,
  CACHE_TTL,
} from "@/common/infrastructure/cache/cache-keys.constants";

interface OrderCacheData {
  orders: {
    id: string;
    userId: string;
    totalPrice: number;
    discountPrice: number;
    finalPrice: number;
    status: OrderStatus;
    failedReason: string | null;
    idempotencyKey: string;
    appliedUserCouponId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  totalCount: number;
  lastUpdated: string;
}

@Injectable()
export class GetOrdersByUserIdWithCacheUseCase {
  constructor(
    private readonly getOrdersByUserIdUseCase: GetOrdersByUserIdUseCase,
    private readonly cacheService: CacheService
  ) {}

  async execute(userId: string): Promise<Order[]> {
    const cacheKey = CACHE_KEYS.USER_ORDERS(userId);
    const cachedOrders = await this.cacheService.get<OrderCacheData>(cacheKey);

    if (cachedOrders) {
      return cachedOrders.orders.map(
        (order) =>
          new Order({
            ...order,
            createdAt: new Date(order.createdAt),
            updatedAt: new Date(order.updatedAt),
            OrderItems: [], // 캐시에서는 OrderItems는 별도로 관리
          })
      );
    }

    const orders = await this.getOrdersByUserIdUseCase.execute(userId);

    const cacheData: OrderCacheData = {
      orders: orders.map((order) => ({
        id: order.id,
        userId: order.userId,
        totalPrice: order.totalPrice,
        discountPrice: order.discountPrice,
        finalPrice: order.finalPrice,
        status: order.status,
        failedReason: order.failedReason,
        idempotencyKey: order.idempotencyKey,
        appliedUserCouponId: order.appliedUserCouponId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      totalCount: orders.length,
      lastUpdated: new Date().toISOString(),
    };

    await this.cacheService.set(cacheKey, cacheData, CACHE_TTL.USER_ORDERS);

    return orders;
  }
}
