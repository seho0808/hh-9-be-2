import { Injectable } from "@nestjs/common";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { Transactional } from "typeorm-transactional";

export interface GetStockReservationsByOrderIdUseCaseCommand {
  orderId: string;
}

export interface GetStockReservationsByOrderIdUseCaseResult {
  stockReservations: StockReservation[];
}

@Injectable()
export class GetStockReservationsByOrderIdUseCase {
  constructor(
    private readonly stockReservationRepository: StockReservationRepository
  ) {}

  @Transactional()
  async execute(
    command: GetStockReservationsByOrderIdUseCaseCommand
  ): Promise<GetStockReservationsByOrderIdUseCaseResult> {
    const { orderId } = command;

    const stockReservations =
      await this.stockReservationRepository.findByOrderId(orderId);

    return { stockReservations };
  }
}
