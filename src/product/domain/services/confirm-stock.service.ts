import { Product } from "../entities/product.entity";
import { StockReservation } from "../entities/stock-reservation.entity";
import {
  StockReservationExpiredError,
  StockReservationNotActiveError,
} from "../exceptions/product.exceptions";

export class ConfirmStockDomainService {
  async confirmStock({
    stockReservation,
    product,
    idempotencyKey,
  }: {
    stockReservation: StockReservation;
    product: Product;
    idempotencyKey: string;
  }): Promise<void> {
    if (!stockReservation.isActive) {
      throw new StockReservationNotActiveError(stockReservation.id);
    }

    if (stockReservation.expiresAt < new Date()) {
      throw new StockReservationExpiredError(stockReservation.id);
    }

    stockReservation.confirmStock(idempotencyKey);
  }
}
