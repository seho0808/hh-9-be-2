import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import { StockReservationOrProductNotFoundError } from "@/product/application/product.application.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";
import { Transactional } from "typeorm-transactional";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";

export interface ReleaseStockCommand {
  stockReservationId: string;
  orderId: string;
}

@Injectable()
export class ReleaseStockUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly stockReservationRepository: StockReservationRepository,
    private readonly validateStockService: ValidateStockService
  ) {}

  @Transactional()
  async execute(command: ReleaseStockCommand): Promise<{
    stockReservation: StockReservation;
    product: Product;
  }> {
    const { stockReservationId, orderId } = command;

    const product =
      await this.productRepository.findByStockReservationId(stockReservationId);

    if (!product) {
      throw new StockReservationOrProductNotFoundError(stockReservationId);
    }

    const stockReservation =
      await this.stockReservationRepository.findByIdWithLock(
        stockReservationId
      );

    this.validateStockService.validateReleaseStock({
      stockReservation,
    });

    product.releaseStock(stockReservation.quantity);
    stockReservation.releaseStock(orderId);

    await Promise.all([
      this.stockReservationRepository.save(stockReservation),
      this.productRepository.save(product),
    ]);

    return { stockReservation, product };
  }
}
