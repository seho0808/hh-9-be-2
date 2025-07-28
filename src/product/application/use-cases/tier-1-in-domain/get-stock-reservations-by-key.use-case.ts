import { Inject, Injectable } from "@nestjs/common";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";

export interface GetStockReservationsByKeyUseCaseCommand {
  idempotencyKey: string;
}

export interface GetStockReservationsByKeyUseCaseResult {
  stockReservations: StockReservation[];
}

@Injectable()
export class GetStockReservationsByKeyUseCase {
  constructor(
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepositoryInterface
  ) {}

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
