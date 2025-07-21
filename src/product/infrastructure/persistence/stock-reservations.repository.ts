import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import { StockReservationTypeOrmEntity } from "./orm/stock-reservations.typeorm.entity";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";

@Injectable()
export class StockReservationRepository
  implements StockReservationRepositoryInterface
{
  constructor(
    @InjectRepository(StockReservationTypeOrmEntity)
    private readonly stockReservationRepository: Repository<StockReservationTypeOrmEntity>
  ) {}

  async save(stockReservation: StockReservation): Promise<StockReservation> {
    const entity = this.fromDomain(stockReservation);
    const savedEntity = await this.stockReservationRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<StockReservation | null> {
    const entity = await this.stockReservationRepository.findOne({
      where: { id },
    });
    return entity ? this.toDomain(entity) : null;
  }

  private fromDomain(
    stockReservation: StockReservation
  ): StockReservationTypeOrmEntity {
    return stockReservation.toPersistence();
  }

  private toDomain(entity: StockReservationTypeOrmEntity): StockReservation {
    return StockReservation.fromPersistence(entity);
  }
}
