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
    return PointTransaction.fromPersistence({
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
    const props = pointTransaction.toPersistence();
    const entity = new PointTransactionTypeOrmEntity();
    entity.id = props.id;
    entity.userId = props.userId;
    entity.amount = props.amount;
    entity.type = props.type as PointTransactionType;
    entity.idempotencyKey = props.idempotencyKey;
    entity.createdAt = props.createdAt;
    return entity;
  }
}
