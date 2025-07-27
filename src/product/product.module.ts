import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductController } from "./infrastructure/http/product.controller";
import { TransactionService } from "../common/services/transaction.service";
import { ProductApplicationService } from "./application/services/product.service";
import { ProductRepository } from "./infrastructure/persistence/product.repository";
import { ProductTypeOrmEntity } from "./infrastructure/persistence/orm/product.typeorm.entity";
import { GetProductByIdUseCase } from "./application/use-cases/get-product-by-id.use-case";
import { GetProductByIdsUseCase } from "./application/use-cases/get-product-by-ids.use-case";
import { GetAllProductsUseCase } from "./application/use-cases/get-all-products.use-case";
import { ReserveStockUseCase } from "./application/use-cases/reserve-stock.use-case";
import { ReleaseStockUseCase } from "./application/use-cases/release-stock.use-case";
import { ConfirmStockUseCase } from "./application/use-cases/confirm-stock.use-case";
import { GetStockReservationsByKeyUseCase } from "./application/use-cases/get-stock-reservations-by-key.use-case";
import { AuthModule } from "../auth/auth.module";
import { StockReservationTypeOrmEntity } from "./infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { StockReservationRepository } from "./infrastructure/persistence/stock-reservations.repository";
import { forwardRef } from "@nestjs/common";
import { OrderModule } from "../order/order.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductTypeOrmEntity,
      StockReservationTypeOrmEntity,
    ]),
    AuthModule,
    forwardRef(() => OrderModule),
  ],
  controllers: [ProductController],
  providers: [
    TransactionService,
    ProductApplicationService,
    GetProductByIdUseCase,
    GetProductByIdsUseCase,
    GetAllProductsUseCase,
    ReserveStockUseCase,
    ReleaseStockUseCase,
    ConfirmStockUseCase,
    GetStockReservationsByKeyUseCase,
    {
      provide: "ProductRepositoryInterface",
      useClass: ProductRepository,
    },
    {
      provide: "StockReservationRepositoryInterface",
      useClass: StockReservationRepository,
    },
  ],
  exports: [
    ProductApplicationService,
    {
      provide: "StockReservationRepositoryInterface",
      useClass: StockReservationRepository,
    },
  ],
})
export class ProductModule {}
