import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import {
  ProductNotFoundError,
  StockReservationNotFoundError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { ConfirmStockDomainService } from "@/product/domain/services/confirm-stock.service";
import { Transactional } from "typeorm-transactional";

export interface ConfirmStockCommand {
  stockReservationId: string;
  idempotencyKey: string;
}

@Injectable()
export class ConfirmStockUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface,
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepositoryInterface,
    private readonly confirmStockDomainService: ConfirmStockDomainService
  ) {}

  @Transactional()
  async execute(command: ConfirmStockCommand): Promise<{
    stockReservation: StockReservation;
    product: Product;
  }> {
    const { stockReservationId, idempotencyKey } = command;

    const stockReservation =
      await this.stockReservationRepository.findById(stockReservationId);

    if (!stockReservation) {
      throw new StockReservationNotFoundError(stockReservationId);
    }

    const product = await this.productRepository.findById(
      stockReservation.productId
    );

    if (!product) {
      throw new ProductNotFoundError(product.id);
    }

    await this.confirmStockDomainService.confirmStock({
      stockReservation,
      product,
      idempotencyKey,
    });

    await this.stockReservationRepository.save(stockReservation);
    await this.productRepository.save(product);

    return {
      stockReservation,
      product,
    };
  }
}
