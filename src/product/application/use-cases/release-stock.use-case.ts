import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import {
  StockReservationNotActiveError,
  StockReservationNotFoundError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";

export interface ReleaseStockCommand {
  stockReservationId: string;
  idempotencyKey: string;
}

@Injectable()
export class ReleaseStockUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface,
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepositoryInterface
  ) {}

  async execute(command: ReleaseStockCommand): Promise<{
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

    const product = await this.productRepository.findById(
      stockReservation.productId
    );

    stockReservation.releaseStock(idempotencyKey);
    product.releaseStock(stockReservation.quantity);

    await this.stockReservationRepository.save(stockReservation);
    await this.productRepository.save(product);

    return { stockReservation, product };
  }
}
