import { Product } from "../entities/product.entity";
import {
  StockReservation,
  StockReservationStatus,
} from "../entities/stock-reservation.entity";
import {
  InactiveProductError,
  InsufficientStockError,
  InvalidQuantityError,
  StockReservationAlreadyReleasedError,
  StockReservationExpiredError,
  StockReservationNotActiveError,
} from "../exceptions/product.exceptions";

export class ValidateStockService {
  validateConfirmStock({
    stockReservation,
  }: {
    stockReservation: StockReservation;
  }): void {
    if (stockReservation.status !== StockReservationStatus.RESERVED) {
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
    if (stockReservation.status === StockReservationStatus.RELEASED) {
      throw new StockReservationAlreadyReleasedError(stockReservation.id);
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
