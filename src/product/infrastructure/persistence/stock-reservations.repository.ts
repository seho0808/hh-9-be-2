import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { StockReservationRepositoryInterface } from "@/product/domain/interfaces/stock-reservation.repository.interface";
import { StockReservationTypeOrmEntity } from "./orm/stock-reservations.typeorm.entity";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { TransactionContext } from "@/common/services/transaction.service";

@Injectable()
export class StockReservationRepository
  implements StockReservationRepositoryInterface
{
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(StockReservationTypeOrmEntity)
    private readonly stockReservationRepository: Repository<StockReservationTypeOrmEntity>
  ) {
    TransactionContext.registerRepository(this);
  }

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<StockReservationTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(StockReservationTypeOrmEntity)
      : this.stockReservationRepository;
  }

  async save(stockReservation: StockReservation): Promise<StockReservation> {
    const repository = this.getRepository();
    const entity = this.fromDomain(stockReservation);
    const savedEntity = await repository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<StockReservation | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({
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
