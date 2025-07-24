import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { UserBalanceTypeOrmEntity } from "./orm/user-balance.typeorm.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";

@Injectable()
export class UserBalanceRepository implements UserBalanceRepositoryInterface {
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(UserBalanceTypeOrmEntity)
    private readonly userBalanceRepository: Repository<UserBalanceTypeOrmEntity>
  ) {}

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<UserBalanceTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(UserBalanceTypeOrmEntity)
      : this.userBalanceRepository;
  }

  async findByUserId(userId: string): Promise<UserBalance | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({
      where: { userId },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async save(userBalance: UserBalance): Promise<UserBalance> {
    const repository = this.getRepository();
    const entity = this.fromDomain(userBalance);
    const savedEntity = await repository.save(entity);
    return this.toDomain(savedEntity);
  }

  private toDomain(entity: UserBalanceTypeOrmEntity): UserBalance {
    return UserBalance.fromPersistence({
      id: entity.id,
      userId: entity.userId,
      balance: entity.balance,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private fromDomain(domain: UserBalance): UserBalanceTypeOrmEntity {
    const props = domain.toPersistence();
    const entity = new UserBalanceTypeOrmEntity();
    entity.id = props.id;
    entity.userId = props.userId;
    entity.balance = props.balance;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }
}
