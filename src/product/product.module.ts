import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductController } from "./infrastructure/http/product.controller";
import { ProductApplicationService } from "./application/services/product.service";
import { ProductRepository } from "./infrastructure/persistence/product.repository";
import { ProductTypeOrmEntity } from "./infrastructure/persistence/orm/product.typeorm.entity";
import { GetProductByIdUseCase } from "./domain/use-cases/get-product-by-id.use-case";
import { GetAllProductsUseCase } from "./domain/use-cases/get-all-products.use-case";
import { ReserveStockUseCase } from "./domain/use-cases/reserve-stock.use-case";
import { ReleaseStockUseCase } from "./domain/use-cases/release-stock.use-case";
import { ConfirmStockUseCase } from "./domain/use-cases/confirm-stock.use-case";
import { AuthModule } from "../auth/auth.module";
import { StockReservationTypeOrmEntity } from "./infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { StockReservationRepository } from "./infrastructure/persistence/stock-reservations.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductTypeOrmEntity,
      StockReservationTypeOrmEntity,
    ]),
    AuthModule,
  ],
  controllers: [ProductController],
  providers: [
    ProductApplicationService,
    GetProductByIdUseCase,
    GetAllProductsUseCase,
    ReserveStockUseCase,
    ReleaseStockUseCase,
    ConfirmStockUseCase,
    {
      provide: "ProductRepositoryInterface",
      useClass: ProductRepository,
    },
    {
      provide: "StockReservationRepositoryInterface",
      useClass: StockReservationRepository,
    },
  ],
  exports: [ProductApplicationService],
})
export class ProductModule {}
