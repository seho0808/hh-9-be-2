import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { GetProductByIdUseCase } from "@/product/application/use-cases/get-product-by-id.use-case";
import { GetAllProductsUseCase } from "@/product/application/use-cases/get-all-products.use-case";
import {
  GetAllProductsInputDto,
  GetAllProductsOutputDto,
} from "@/product/application/dto/get-all-products";
import {
  ReserveStockUseCase,
  ReserveStockCommand,
} from "@/product/application/use-cases/reserve-stock.use-case";
import {
  ReleaseStockUseCase,
  ReleaseStockCommand,
} from "@/product/application/use-cases/release-stock.use-case";
import { Product } from "@/product/domain/entities/product.entity";
import { validateOrReject } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ProductValidationException } from "@/product/application/exceptions/validation.exceptions";
import {
  ConfirmStockCommand,
  ConfirmStockUseCase,
} from "@/product/application/use-cases/confirm-stock.use-case";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { GetProductByIdsUseCase } from "@/product/application/use-cases/get-product-by-ids.use-case";
import { GetStockReservationsByKeyUseCase } from "@/product/application/use-cases/get-stock-reservations-by-key.use-case";
import { TransactionService } from "@/common/services/transaction.service";
import { OrderStatApplicationService } from "@/order/application/order-stat.service";
import { PopularProductResult } from "@/order/domain/interfaces/order-item.repository.interface";

@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly getProductByIdsUseCase: GetProductByIdsUseCase,
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    private readonly confirmStockUseCase: ConfirmStockUseCase,
    private readonly getStockReservationsByKeyUseCase: GetStockReservationsByKeyUseCase,
    private readonly orderStatApplicationService: OrderStatApplicationService
  ) {}

  async getProductById(id: string): Promise<Product | null> {
    return await this.getProductByIdUseCase.execute(id);
  }

  async getProductByIds(ids: string[]): Promise<Product[]> {
    return await this.getProductByIdsUseCase.execute(ids);
  }

  async getAllProducts(
    query: GetAllProductsInputDto
  ): Promise<GetAllProductsOutputDto> {
    const dto = plainToInstance(GetAllProductsInputDto, query);
    await validateOrReject(dto).catch((errors) => {
      throw new ProductValidationException(errors);
    });

    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.getAllProductsUseCase.execute(dto);
    });
  }

  async reserveStock(
    command: ReserveStockCommand,
    parentManager?: EntityManager
  ): Promise<{ product: Product; stockReservation: StockReservation }> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.reserveStockUseCase.execute(command);
    }, parentManager);
  }

  async releaseStock(
    command: ReleaseStockCommand,
    parentManager?: EntityManager
  ): Promise<Product> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      const { product } = await this.releaseStockUseCase.execute(command);
      return product;
    }, parentManager);
  }

  async confirmStock(
    command: ConfirmStockCommand,
    parentManager?: EntityManager
  ): Promise<Product> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      const { product } = await this.confirmStockUseCase.execute(command);
      return product;
    }, parentManager);
  }

  async getPopularProducts(limit?: number): Promise<
    {
      product: Product;
      statistics: PopularProductResult;
    }[]
  > {
    const popularProductsStats =
      await this.orderStatApplicationService.getPopularProducts(limit);

    if (popularProductsStats.length === 0) {
      return [];
    }

    const productIds = popularProductsStats.map((stat) => stat.productId);
    const products = await this.getProductByIds(productIds);

    const productMap = new Map<string, Product>();
    products.forEach((product) => {
      productMap.set(product.id, product);
    });

    return popularProductsStats
      .map((stat) => {
        const product = productMap.get(stat.productId);
        return product ? { product, statistics: stat } : null;
      })
      .filter(
        (
          item
        ): item is { product: Product; statistics: PopularProductResult } =>
          item !== null
      );
  }

  async getStockReservationIdsByIdempotencyKey(
    idempotencyKey: string
  ): Promise<string[]> {
    const { stockReservations } =
      await this.getStockReservationsByKeyUseCase.execute({
        idempotencyKey,
      });
    return stockReservations.map((reservation) => reservation.id);
  }
}
