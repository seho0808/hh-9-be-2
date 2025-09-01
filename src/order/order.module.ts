import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PopularProductsScheduler } from "./infrastructure/schedulers/popular-products.scheduler";
import {
  OrderController,
  UserOrderController,
} from "./presentation/http/order.controller";
import { AuthModule } from "../auth/auth.module";
import { ProductModule } from "../product/product.module";
import { WalletModule } from "../wallet/wallet.module";
import { CouponModule } from "../coupon/coupon.module";

// Infrastructure
import { OrderTypeOrmEntity } from "./infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "./infrastructure/persistence/orm/order-item.typeorm.entity";
import { OrderRepository } from "./infrastructure/persistence/order.repository";
import { OrderItemRepository } from "./infrastructure/persistence/order-item.repository";
import { OrderItemRedisRepository } from "./infrastructure/persistence/order-item-redis.repository";
import { CouponRepository } from "../coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "../coupon/infrastructure/persistence/user-coupon.repository";
import { ProductRepository } from "../product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "../product/infrastructure/persistence/stock-reservations.repository";
import { UserBalanceRepository } from "../wallet/infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "../wallet/infrastructure/persistence/point-transaction.repository";
import { CouponTypeOrmEntity } from "../coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { ProductTypeOrmEntity } from "../product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "../product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "../wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "../wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";

// Domain Use Cases
import { CreateOrderUseCase } from "./application/use-cases/tier-1-in-domain/create-order.use-case";
import { ApplyDiscountUseCase } from "./application/use-cases/tier-1-in-domain/apply-discount.use-case";
import { ChangeOrderStatusUseCase } from "./application/use-cases/tier-1-in-domain/change-order-status.use-case";
import { GetOrderByIdUseCase } from "./application/use-cases/tier-1-in-domain/get-order-by-id.use-case";
import { GetOrdersByUserIdUseCase } from "./application/use-cases/tier-1-in-domain/get-orders-by-user-id.use-case";
import { FindStalePendingOrdersUseCase } from "./application/use-cases/tier-1-in-domain/find-stale-pending-orders.use-case";
import { FindFailedOrdersUseCase } from "./application/use-cases/tier-1-in-domain/find-failed-orders.use-case";
import { GetPopularProductsUseCase } from "./application/use-cases/tier-1-in-domain/get-popular-products.use-case";
import { UpdateProductRankingUseCase } from "./application/use-cases/tier-1-in-domain/update-product-ranking.use-case";
import { PlaceOrderUseCase } from "./application/use-cases/tier-4/place-order.use-case";
import { RecoverOrderUseCase } from "./application/use-cases/tier-2/recover-order.use-case";
import { PrepareOrderUseCase } from "./application/use-cases/tier-3/prepare-order.use-case";
import { ProcessOrderUseCase } from "./application/use-cases/tier-2/process-order.use-case";
import { AutoRecoverOrdersUseCase } from "./application/use-cases/tier-3/auto-recover-orders.use-case";
import { RefreshPopularProductsCacheUseCase } from "./application/use-cases/tier-1-in-domain/refresh-popular-products-cache.use-case";
import { GetOrdersByUserIdWithCacheUseCase } from "./application/use-cases/tier-2/get-orders-by-user-id-with-cache.use-case";
import { CacheModule } from "@/common/infrastructure/cache/cache.module";
import { RedisModule } from "@/common/infrastructure/config/redis.module";
import { DataPlatformMessaging } from "@/order/infrastructure/messaging/data-platform.messaging";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderTypeOrmEntity,
      OrderItemTypeOrmEntity,
      CouponTypeOrmEntity,
      UserCouponTypeOrmEntity,
      ProductTypeOrmEntity,
      StockReservationTypeOrmEntity,
      UserBalanceTypeOrmEntity,
      PointTransactionTypeOrmEntity,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => ProductModule),
    WalletModule,
    CouponModule,
    CacheModule,
    RedisModule,
  ],
  controllers: [OrderController, UserOrderController],
  providers: [
    CreateOrderUseCase,
    ApplyDiscountUseCase,
    ChangeOrderStatusUseCase,
    GetOrderByIdUseCase,
    GetOrdersByUserIdUseCase,
    GetOrdersByUserIdWithCacheUseCase,
    FindStalePendingOrdersUseCase,
    FindFailedOrdersUseCase,
    GetPopularProductsUseCase,
    UpdateProductRankingUseCase,
    PlaceOrderUseCase,
    PrepareOrderUseCase,
    ProcessOrderUseCase,
    RecoverOrderUseCase,
    AutoRecoverOrdersUseCase,
    RefreshPopularProductsCacheUseCase,
    OrderRepository,
    OrderItemRepository,
    OrderItemRedisRepository,
    PopularProductsScheduler,
    DataPlatformMessaging,
    {
      provide: "POPULAR_PRODUCTS_QUERY_PORT",
      useExisting: OrderItemRepository,
    },
    {
      provide: "REALTIME_POPULAR_PRODUCTS_QUERY_PORT",
      useExisting: OrderItemRedisRepository,
    },
    CouponRepository,
    UserCouponRepository,
    ProductRepository,
    StockReservationRepository,
    UserBalanceRepository,
    PointTransactionRepository,
  ],
  exports: [
    GetPopularProductsUseCase,
    "POPULAR_PRODUCTS_QUERY_PORT",
    "REALTIME_POPULAR_PRODUCTS_QUERY_PORT",
  ],
})
export class OrderModule {}
