import { Injectable } from "@nestjs/common";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { Transactional } from "typeorm-transactional";

export interface GetStockReservationsByKeyUseCaseCommand {
  idempotencyKey: string;
}

export interface GetStockReservationsByKeyUseCaseResult {
  stockReservations: StockReservation[];
}

@Injectable()
export class GetStockReservationsByKeyUseCase {
  constructor(
    private readonly stockReservationRepository: StockReservationRepository
  ) {}

  @Transactional()
  async execute(
    command: GetStockReservationsByKeyUseCaseCommand
  ): Promise<GetStockReservationsByKeyUseCaseResult> {
    const { idempotencyKey } = command;

    const stockReservations =
      await this.stockReservationRepository.findByIdempotencyKey(
        idempotencyKey
      );

    return { stockReservations };
  }
}
