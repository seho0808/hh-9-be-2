import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductController } from "./presentation/http/product.controller";
import { ProductRepository } from "./infrastructure/persistence/product.repository";
import { ProductTypeOrmEntity } from "./infrastructure/persistence/orm/product.typeorm.entity";
import { GetProductByIdUseCase } from "./application/use-cases/tier-1-in-domain/get-product-by-id.use-case";
import { GetProductsByIdsUseCase } from "./application/use-cases/tier-1-in-domain/get-products-by-ids.use-case";
import { GetAllProductsUseCase } from "./application/use-cases/tier-1-in-domain/get-all-products.use-case";
import { ReserveStockUseCase } from "./application/use-cases/tier-1-in-domain/reserve-stock.use-case";
import { ReleaseStockUseCase } from "./application/use-cases/tier-1-in-domain/release-stock.use-case";
import { ConfirmStockUseCase } from "./application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { GetStockReservationsByKeyUseCase } from "./application/use-cases/tier-1-in-domain/get-stock-reservations-by-key.use-case";
import { AuthModule } from "../auth/auth.module";
import { StockReservationTypeOrmEntity } from "./infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { StockReservationRepository } from "./infrastructure/persistence/stock-reservations.repository";
import { OrderModule } from "../order/order.module";
import { GetPopularProductsWithDetailUseCase } from "./application/use-cases/tier-2/get-popular-products-with-detail.use-case";
import { ReserveStocksUseCase } from "./application/use-cases/tier-2/reserve-stocks.use-case";
import { GetProductsPriceUseCase } from "./application/use-cases/tier-1-in-domain/get-products-price.use-case";
import { ValidateStockService } from "./domain/services/validate-stock.service";

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
    GetProductByIdUseCase,
    GetProductsByIdsUseCase,
    GetProductsPriceUseCase,
    GetAllProductsUseCase,
    ReserveStockUseCase,
    ReserveStocksUseCase,
    ReleaseStockUseCase,
    ConfirmStockUseCase,
    GetStockReservationsByKeyUseCase,
    GetPopularProductsWithDetailUseCase,
    ValidateStockService,
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
    GetProductsPriceUseCase,
    GetProductsByIdsUseCase,
    ReserveStocksUseCase,
    ReleaseStockUseCase,
    ConfirmStockUseCase,
  ],
})
export class ProductModule {}
