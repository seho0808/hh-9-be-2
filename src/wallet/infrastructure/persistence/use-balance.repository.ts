import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserBalanceTypeOrmEntity } from "./orm/user-balance.typeorm.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";

@Injectable()
export class UserBalanceRepository implements UserBalanceRepositoryInterface {
  constructor(
    @InjectRepository(UserBalanceTypeOrmEntity)
    private readonly userBalanceRepository: Repository<UserBalanceTypeOrmEntity>
  ) {}

  async findByUserId(userId: string): Promise<UserBalance | null> {
    const entity = await this.userBalanceRepository.findOne({
      where: { userId },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async save(userBalance: UserBalance): Promise<UserBalance> {
    const entity = this.fromDomain(userBalance);
    const savedEntity = await this.userBalanceRepository.save(entity);
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
