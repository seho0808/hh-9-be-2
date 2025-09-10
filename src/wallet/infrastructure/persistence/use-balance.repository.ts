import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, UpdateResult } from "typeorm";
import { UserBalanceTypeOrmEntity } from "./orm/user-balance.typeorm.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { OptimisticLockError } from "@/common/infrastructure/infrastructure.exceptions";

@Injectable()
export class UserBalanceRepository {
  constructor(
    @InjectRepository(UserBalanceTypeOrmEntity)
    private readonly userBalanceRepository: Repository<UserBalanceTypeOrmEntity>
  ) {}

  async findByUserId(userId: string): Promise<{
    userBalance: UserBalance;
    metadata: { version: number };
  } | null> {
    const entity = await this.userBalanceRepository.findOne({
      where: { userId },
    });
    return entity
      ? {
          userBalance: this.toDomain(entity),
          metadata: { version: entity.version },
        }
      : null;
  }

  async saveWithOptimisticLock(
    userBalance: UserBalance,
    version: number
  ): Promise<UserBalance> {
    const entity = this.fromDomain(userBalance);

    // version 필드 제외하고 업데이트할 데이터 준비
    const updateData = {
      balance: entity.balance,
      updatedAt: entity.updatedAt,
    };

    const result: UpdateResult = await this.userBalanceRepository
      .createQueryBuilder()
      .update(UserBalanceTypeOrmEntity)
      .set({
        ...updateData,
        version: () => "version + 1", // 버전을 1 증가
      })
      .where("id = :id", { id: entity.id })
      .andWhere("version = :version", { version })
      .execute();

    if (result.affected === 0) {
      // 현재 엔티티의 버전 확인
      const currentEntity = await this.userBalanceRepository.findOne({
        where: { id: entity.id },
      });
      throw new OptimisticLockError(entity.id, version, currentEntity?.version);
    }

    // 업데이트된 엔티티 조회
    const updated = await this.userBalanceRepository.findOneByOrFail({
      id: entity.id,
    });

    return this.toDomain(updated);
  }

  async save(userBalance: UserBalance): Promise<UserBalance> {
    const entity = this.fromDomain(userBalance);
    const saved = await this.userBalanceRepository.save(entity);
    return this.toDomain(saved);
  }

  private toDomain(entity: UserBalanceTypeOrmEntity): UserBalance {
    return new UserBalance({
      id: entity.id,
      userId: entity.userId,
      balance: entity.balance,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private fromDomain(domain: UserBalance): UserBalanceTypeOrmEntity {
    const entity = new UserBalanceTypeOrmEntity();
    entity.id = domain.id;
    entity.userId = domain.userId;
    entity.balance = domain.balance;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
