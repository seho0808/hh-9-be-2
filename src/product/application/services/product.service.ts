import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { GetProductByIdUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-product-by-id.use-case";
import { GetAllProductsUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-all-products.use-case";
import {
  GetAllProductsInputDto,
  GetAllProductsOutputDto,
} from "@/product/application/dto/get-all-products";
import {
  ReserveStockUseCase,
  ReserveStockCommand,
} from "@/product/application/use-cases/tier-1-in-domain/reserve-stock.use-case";
import {
  ReleaseStockUseCase,
  ReleaseStockCommand,
} from "@/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { Product } from "@/product/domain/entities/product.entity";
import { validateOrReject } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ProductValidationException } from "@/product/application/exceptions/validation.exceptions";
import {
  ConfirmStockCommand,
  ConfirmStockUseCase,
} from "@/product/application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { GetStockReservationsByKeyUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-stock-reservations-by-key.use-case";
import { TransactionService } from "@/common/services/transaction.service";
import {
  GetPopularProductsWithDetailUseCase,
  PopularProductsWithDetailResult,
} from "../use-cases/tier-2/get-popular-products.use-case";

@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    private readonly confirmStockUseCase: ConfirmStockUseCase,
    private readonly getStockReservationsByKeyUseCase: GetStockReservationsByKeyUseCase,
    private readonly getPopularProductsWithDetailUseCase: GetPopularProductsWithDetailUseCase
  ) {}

  async getProductById(id: string): Promise<Product | null> {
    return await this.getProductByIdUseCase.execute(id);
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

  async getPopularProducts(
    limit?: number
  ): Promise<PopularProductsWithDetailResult> {
    return this.getPopularProductsWithDetailUseCase.execute({ limit });
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
