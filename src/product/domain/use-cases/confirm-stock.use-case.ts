import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import {
  StockReservationExpiredError,
  StockReservationNotActiveError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import { StockReservationNotFoundError } from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "../entities/stock-reservation.entity";

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
    private readonly stockReservationRepository: StockReservationRepositoryInterface
  ) {}

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

    if (!stockReservation.isActive) {
      throw new StockReservationNotActiveError(stockReservationId);
    }

    if (stockReservation.expiresAt < new Date()) {
      throw new StockReservationExpiredError(stockReservationId);
    }

    const product = await this.productRepository.findById(
      stockReservation.productId
    );

    stockReservation.confirmStock(idempotencyKey);

    await this.stockReservationRepository.save(stockReservation);
    await this.productRepository.save(product);

    return {
      stockReservation,
      product,
    };
  }
}
