import { Injectable, Inject } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { GetProductByIdUseCase } from "@/product/domain/use-cases/get-product-by-id.use-case";
import { GetAllProductsUseCase } from "@/product/domain/use-cases/get-all-products.use-case";
import {
  GetAllProductsInputDto,
  GetAllProductsOutputDto,
} from "@/product/application/dto/get-all-products";
import {
  ReserveStockUseCase,
  ReserveStockCommand,
} from "@/product/domain/use-cases/reserve-stock.use-case";
import {
  ReleaseStockUseCase,
  ReleaseStockCommand,
} from "@/product/domain/use-cases/release-stock.use-case";
import { Product } from "@/product/domain/entities/product.entity";
import { validateOrReject } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ProductValidationException } from "@/product/application/exceptions/validation.exceptions";
import {
  ConfirmStockCommand,
  ConfirmStockUseCase,
} from "@/product/domain/use-cases/confirm-stock.use-case";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { GetProductByIdsUseCase } from "@/product/domain/use-cases/get-product-by-ids.use-case";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { TransactionService } from "@/common/services/transaction.service";

@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepository,
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepository,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly getProductByIdsUseCase: GetProductByIdsUseCase,
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    private readonly confirmStockUseCase: ConfirmStockUseCase
  ) {}

  async getProductById(productId: string): Promise<Product> {
    return await this.getProductByIdUseCase.execute(productId);
  }

  async getProductByIds(productIds: string[]): Promise<Product[]> {
    return await this.getProductByIdsUseCase.execute(productIds);
  }

  async getAllProducts(
    query: GetAllProductsInputDto
  ): Promise<GetAllProductsOutputDto> {
    const dto = plainToInstance(GetAllProductsInputDto, query);
    await validateOrReject(dto).catch((errors) => {
      throw new ProductValidationException(errors);
    });

    return this.getAllProductsUseCase.execute(dto);
  }

  async reserveStock(
    command: ReserveStockCommand,
    parentManager?: EntityManager
  ): Promise<{ product: Product; stockReservation: StockReservation }> {
    return await this.executeInTransaction(async () => {
      return await this.reserveStockUseCase.execute(command);
    }, parentManager);
  }

  async releaseStock(
    command: ReleaseStockCommand,
    parentManager?: EntityManager
  ): Promise<Product> {
    return await this.executeInTransaction(async () => {
      const { product } = await this.releaseStockUseCase.execute(command);
      return product;
    }, parentManager);
  }

  async confirmStock(
    command: ConfirmStockCommand,
    parentManager?: EntityManager
  ): Promise<Product> {
    return await this.executeInTransaction(async () => {
      const { product } = await this.confirmStockUseCase.execute(command);
      return product;
    }, parentManager);
  }

  async getPopularProducts(limit?: number): Promise<any[]> {
    // TODO: Order 도메인 구현 진행 된 후에 구현 가능함.
    return [];
  }

  private async executeInTransaction<T>(
    operation: (manager?: EntityManager) => Promise<T>,
    parentManager?: EntityManager
  ): Promise<T> {
    const repositories = [
      this.productRepository,
      this.stockReservationRepository,
    ];

    return await this.transactionService.executeInTransaction(
      repositories,
      operation,
      parentManager
    );
  }
}
