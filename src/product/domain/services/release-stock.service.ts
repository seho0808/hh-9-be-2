import { Product } from "../entities/product.entity";
import { StockReservation } from "../entities/stock-reservation.entity";
import { StockReservationNotActiveError } from "../exceptions/product.exceptions";

export class ReleaseStockDomainService {
  async releaseStock({
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

    product.releaseStock(stockReservation.quantity);
    stockReservation.releaseStock(idempotencyKey);
  }
}
