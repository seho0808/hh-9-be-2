import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductNotFoundError } from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Transactional } from "typeorm-transactional";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";

export interface ReserveStockCommand {
  productId: string;
  userId: string;
  quantity: number;
  orderId: string;
}

@Injectable()
export class ReserveStockUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly stockReservationRepository: StockReservationRepository,
    private readonly validateStockService: ValidateStockService
  ) {}

  @Transactional()
  async execute(command: ReserveStockCommand): Promise<{
    stockReservation: StockReservation;
    product: Product;
  }> {
    const { productId, userId, quantity, orderId } = command;

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    this.validateStockService.validateReserveStock({
      product,
      quantity,
    });

    product.reserveStock(quantity);
    const stockReservation = StockReservation.create({
      productId: product.id,
      userId,
      quantity,
      orderId,
    });

    await this.stockReservationRepository.save(stockReservation);
    await this.productRepository.save(product);

    return {
      stockReservation,
      product,
    };
  }
}
