import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import {
  ProductNotFoundError,
  InactiveProductError,
  InsufficientStockError,
  InvalidQuantityError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";

export interface ReserveStockCommand {
  productId: string;
  userId: string;
  quantity: number;
}

@Injectable()
export class ReserveStockUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface,
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepositoryInterface
  ) {}

  async execute(command: ReserveStockCommand): Promise<{
    stockReservation: StockReservation;
    product: Product;
  }> {
    const { productId, userId, quantity } = command;

    if (quantity <= 0) {
      throw new InvalidQuantityError(quantity);
    }

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    if (!product.isActive) {
      throw new InactiveProductError(productId);
    }

    const availableStock = product.getAvailableStock();
    if (availableStock < quantity) {
      throw new InsufficientStockError(productId, availableStock, quantity);
    }

    product.reserveStock(quantity);

    const stockReservation = StockReservation.create({
      productId,
      userId,
      quantity,
    });

    // TODO: service 계층에서 transaction 처리 필요.
    await this.stockReservationRepository.save(stockReservation);
    await this.productRepository.save(product);

    return {
      stockReservation,
      product,
    };
  }
}
