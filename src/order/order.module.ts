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

// Application
import { OrderApplicationService } from "./application/order.service";

// Common services
import { TransactionService } from "../common/services/transaction.service";

// Domain Use Cases
import { CreateOrderUseCase } from "./domain/use-cases/create-order.use-case";
import { ApplyDiscountUseCase } from "./domain/use-cases/apply-discount.use-case";
import { ChangeOrderStatusUseCase } from "./domain/use-cases/change-order-status.use-case";
import { GetOrderByIdUseCase } from "./domain/use-cases/get-order-by-id.use-case";
import { GetOrderByUserIdUseCase } from "./domain/use-cases/get-order-by-user-id.use-case";

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
    forwardRef(() => WalletModule),
    forwardRef(() => CouponModule),
  ],
  controllers: [OrderController, UserOrderController],
  providers: [
    TransactionService,
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
    {
      provide: "CouponRepositoryInterface",
      useClass: CouponRepository,
    },
    {
      provide: "UserCouponRepositoryInterface",
      useClass: UserCouponRepository,
    },
    {
      provide: "ProductRepositoryInterface",
      useClass: ProductRepository,
    },
    {
      provide: "StockReservationRepositoryInterface",
      useClass: StockReservationRepository,
    },
    {
      provide: "UserBalanceRepositoryInterface",
      useClass: UserBalanceRepository,
    },
    {
      provide: "PointTransactionRepositoryInterface",
      useClass: PointTransactionRepository,
    },
  ],
  exports: [OrderApplicationService],
})
export class OrderModule {}
