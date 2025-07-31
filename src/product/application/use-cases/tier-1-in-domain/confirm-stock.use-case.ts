import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import {
  ProductNotFoundError,
  StockReservationNotFoundError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";
import { Transactional } from "typeorm-transactional";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";

export interface ConfirmStockCommand {
  stockReservationId: string;
  idempotencyKey: string;
}

@Injectable()
export class ConfirmStockUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly stockReservationRepository: StockReservationRepository,
    private readonly validateStockService: ValidateStockService
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

    this.validateStockService.validateConfirmStock({
      stockReservation,
    });

    product.confirmStock(stockReservation.quantity);
    stockReservation.confirmStock(idempotencyKey);

    await this.stockReservationRepository.save(stockReservation);
    await this.productRepository.save(product);

    return {
      stockReservation,
      product,
    };
  }
}
