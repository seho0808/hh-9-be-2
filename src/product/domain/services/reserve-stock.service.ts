import { Product } from "../entities/product.entity";
import { StockReservation } from "../entities/stock-reservation.entity";
import {
  InactiveProductError,
  InsufficientStockError,
  InvalidQuantityError,
} from "../exceptions/product.exceptions";

export class ReserveStockDomainService {
  async reserveStock({
    product,
    quantity,
    idempotencyKey,
    userId,
  }: {
    product: Product;
    quantity: number;
    idempotencyKey: string;
    userId: string;
  }): Promise<StockReservation> {
    if (quantity <= 0) {
      throw new InvalidQuantityError(quantity);
    }

    if (!product.isActive) {
      throw new InactiveProductError(product.id);
    }

    const availableStock = product.getAvailableStock();
    if (availableStock < quantity) {
      throw new InsufficientStockError(product.id, availableStock, quantity);
    }

    product.reserveStock(quantity);

    const stockReservation = StockReservation.create({
      productId: product.id,
      userId,
      quantity,
      idempotencyKey,
    });

    return stockReservation;
  }
}
