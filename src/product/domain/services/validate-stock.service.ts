import { Product } from "../entities/product.entity";
import { StockReservation } from "../entities/stock-reservation.entity";
import {
  InactiveProductError,
  InsufficientStockError,
  InvalidQuantityError,
  StockReservationExpiredError,
  StockReservationNotActiveError,
} from "../exceptions/product.exceptions";

export class ValidateStockService {
  validateConfirmStock({
    stockReservation,
  }: {
    stockReservation: StockReservation;
  }): void {
    if (!stockReservation.isActive) {
      throw new StockReservationNotActiveError(stockReservation.id);
    }

    if (stockReservation.expiresAt < new Date()) {
      throw new StockReservationExpiredError(stockReservation.id);
    }
  }

  validateReleaseStock({
    stockReservation,
  }: {
    stockReservation: StockReservation;
  }): void {
    if (!stockReservation.isActive) {
      throw new StockReservationNotActiveError(stockReservation.id);
    }
  }

  validateReserveStock({
    product,
    quantity,
  }: {
    product: Product;
    quantity: number;
  }): void {
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
  }
}
