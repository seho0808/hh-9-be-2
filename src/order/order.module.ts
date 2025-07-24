import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  OrderController,
  UserOrderController,
} from "./infrastructure/http/order.controller";
import { AuthModule } from "../auth/auth.module";
import { ProductModule } from "../product/product.module";
import { WalletModule } from "../wallet/wallet.module";
import { CouponModule } from "../coupon/coupon.module";

// Infrastructure
import { OrderTypeOrmEntity } from "./infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "./infrastructure/persistence/orm/order-item.typeorm.entity";
import { OrderRepository } from "./infrastructure/persistence/order.repository";
import { OrderItemRepository } from "./infrastructure/persistence/order-item.repository";

// Application
import { OrderApplicationService } from "./application/order.service";

// Domain Use Cases
import { CreateOrderUseCase } from "./domain/use-cases/create-order.use-case";
import { ApplyDiscountUseCase } from "./domain/use-cases/apply-discount.use-case";
import { ChangeOrderStatusUseCase } from "./domain/use-cases/change-order-status.use-case";
import { GetOrderByIdUseCase } from "./domain/use-cases/get-order-by-id.use-case";
import { GetOrderByUserIdUseCase } from "./domain/use-cases/get-order-by-user-id.use-case";

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderTypeOrmEntity, OrderItemTypeOrmEntity]),
    forwardRef(() => AuthModule),
    forwardRef(() => ProductModule),
    forwardRef(() => WalletModule),
    forwardRef(() => CouponModule),
  ],
  controllers: [OrderController, UserOrderController],
  providers: [
    OrderApplicationService,
    CreateOrderUseCase,
    ApplyDiscountUseCase,
    ChangeOrderStatusUseCase,
    GetOrderByIdUseCase,
    GetOrderByUserIdUseCase,
    {
      provide: "OrderRepositoryInterface",
      useClass: OrderRepository,
    },
    {
      provide: "OrderItemRepositoryInterface",
      useClass: OrderItemRepository,
    },
  ],
  exports: [OrderApplicationService],
})
export class OrderModule {}
