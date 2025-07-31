import { Injectable } from "@nestjs/common";
import {
  PointTransactionType,
  PointTransactionTypeOrmEntity,
} from "./orm/point-transaction.typeorm.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";

@Injectable()
export class PointTransactionRepository {
  constructor(
    @InjectRepository(PointTransactionTypeOrmEntity)
    private readonly pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>
  ) {}

  async findByUserId(userId: string): Promise<PointTransaction[]> {
    const entities = await this.pointTransactionRepository.find({
      where: { userId },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByOrderIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<PointTransaction[]> {
    const entities = await this.pointTransactionRepository.find({
      where: { userId, idempotencyKey: idempotencyKey },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async save(pointTransaction: PointTransaction): Promise<PointTransaction> {
    const entity = this.fromDomain(pointTransaction);
    const savedEntity = await this.pointTransactionRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  private toDomain(entity: PointTransactionTypeOrmEntity): PointTransaction {
    return new PointTransaction({
      id: entity.id,
      userId: entity.userId,
      amount: entity.amount,
      type: entity.type,
      idempotencyKey: entity.idempotencyKey,
      createdAt: entity.createdAt,
    });
  }

  private fromDomain(
    pointTransaction: PointTransaction
  ): PointTransactionTypeOrmEntity {
    const entity = new PointTransactionTypeOrmEntity();
    entity.id = pointTransaction.id;
    entity.userId = pointTransaction.userId;
    entity.amount = pointTransaction.amount;
    entity.type = pointTransaction.type as PointTransactionType;
    entity.idempotencyKey = pointTransaction.idempotencyKey;
    entity.createdAt = pointTransaction.createdAt;
    return entity;
  }
}
