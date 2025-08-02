import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import { ReserveStockUseCase } from "../tier-1-in-domain/reserve-stock.use-case";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Transactional } from "typeorm-transactional";

export interface ReserveStocksCommand {
  requests: {
    productId: string;
    userId: string;
    quantity: number;
    orderId: string;
  }[];
}

export interface ReserveStocksResult {
  result: {
    stockReservation: StockReservation;
    product: Product;
  }[];
}

@Injectable()
export class ReserveStocksUseCase {
  constructor(private readonly reserveStockUseCase: ReserveStockUseCase) {}

  @Transactional()
  async execute(command: ReserveStocksCommand): Promise<ReserveStocksResult> {
    const result = [];
    for (const request of command.requests) {
      const res = await this.reserveStockUseCase.execute({
        productId: request.productId,
        userId: request.userId,
        quantity: request.quantity,
        orderId: request.orderId,
      });
      result.push(res);
    }
    return { result };
  }
}
