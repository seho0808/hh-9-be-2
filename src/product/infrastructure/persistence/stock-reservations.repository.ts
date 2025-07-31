import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { StockReservationTypeOrmEntity } from "./orm/stock-reservations.typeorm.entity";

@Injectable()
export class StockReservationRepository {
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

  async findByOrderId(orderId: string): Promise<StockReservation[]> {
    const entities = await this.stockReservationRepository.find({
      where: { orderId },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  private fromDomain(
    stockReservation: StockReservation
  ): StockReservationTypeOrmEntity {
    const entity = new StockReservationTypeOrmEntity();
    entity.id = stockReservation.id;
    entity.productId = stockReservation.productId;
    entity.userId = stockReservation.userId;
    entity.quantity = stockReservation.quantity;
    entity.orderId = stockReservation.orderId;
    entity.createdAt = stockReservation.createdAt;
    entity.updatedAt = stockReservation.updatedAt;
    entity.expiresAt = stockReservation.expiresAt;
    entity.isActive = stockReservation.isActive;
    return entity;
  }

  private toDomain(entity: StockReservationTypeOrmEntity): StockReservation {
    return new StockReservation({
      id: entity.id,
      productId: entity.productId,
      userId: entity.userId,
      quantity: entity.quantity,
      orderId: entity.orderId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      expiresAt: entity.expiresAt,
      isActive: entity.isActive,
    });
  }
}
