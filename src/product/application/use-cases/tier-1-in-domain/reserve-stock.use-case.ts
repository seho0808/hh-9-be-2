import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductNotFoundError } from "@/product/domain/exceptions/product.exceptions";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Transactional } from "typeorm-transactional";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";

export interface ReserveStockCommand {
  productId: string;
  userId: string;
  quantity: number;
  idempotencyKey: string;
}

@Injectable()
export class ReserveStockUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface,
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepositoryInterface,
    private readonly validateStockService: ValidateStockService
  ) {}

  @Transactional()
  async execute(command: ReserveStockCommand): Promise<{
    stockReservation: StockReservation;
    product: Product;
  }> {
    const { productId, userId, quantity, idempotencyKey } = command;

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
