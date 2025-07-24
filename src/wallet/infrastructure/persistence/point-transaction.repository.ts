import { PointTransactionRepositoryInterface } from "@/wallet/domain/interfaces/point-transaction.repository.interface";
import { Injectable } from "@nestjs/common";
import {
  PointTransactionType,
  PointTransactionTypeOrmEntity,
} from "./orm/point-transaction.typeorm.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { TransactionContext } from "@/common/services/transaction.service";

@Injectable()
export class PointTransactionRepository
  implements PointTransactionRepositoryInterface
{
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(PointTransactionTypeOrmEntity)
    private readonly pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>
  ) {
    TransactionContext.registerRepository(this);
  }

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<PointTransactionTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(PointTransactionTypeOrmEntity)
      : this.pointTransactionRepository;
  }

  async findByUserId(userId: string): Promise<PointTransaction[]> {
    const repository = this.getRepository();
    const entities = await repository.find({
      where: { userId },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByOrderIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<PointTransaction[]> {
    const repository = this.getRepository();
    const entities = await repository.find({
      where: { userId, idempotencyKey },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async save(pointTransaction: PointTransaction): Promise<PointTransaction> {
    const repository = this.getRepository();
    const entity = this.fromDomain(pointTransaction);
    const savedEntity = await repository.save(entity);
    return this.toDomain(savedEntity);
  }

  private toDomain(entity: PointTransactionTypeOrmEntity): PointTransaction {
    return PointTransaction.fromPersistence({
      id: entity.id,
      userId: entity.userId,
      amount: entity.amount,
      type: entity.type as PointTransactionType,
      idempotencyKey: entity.idempotencyKey,
      createdAt: entity.createdAt,
    });
  }

  private fromDomain(domain: PointTransaction): PointTransactionTypeOrmEntity {
    const props = domain.toPersistence();
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
