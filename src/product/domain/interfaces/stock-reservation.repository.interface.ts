import { StockReservation } from "../entities/stock-reservation.entity";

export interface StockReservationRepositoryInterface {
  save(stockReservation: StockReservation): Promise<StockReservation>;
  findById(id: string): Promise<StockReservation | null>;
}
