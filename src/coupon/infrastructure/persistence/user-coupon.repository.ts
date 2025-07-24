import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { UserCouponTypeOrmEntity } from "./orm/user-coupon.typeorm.entity";
import { TransactionContext } from "@/common/services/transaction.service";

@Injectable()
export class UserCouponRepository implements UserCouponRepositoryInterface {
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(UserCouponTypeOrmEntity)
    private readonly userCouponRepository: Repository<UserCouponTypeOrmEntity>
  ) {
    TransactionContext.registerRepository(this);
  }

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<UserCouponTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(UserCouponTypeOrmEntity)
      : this.userCouponRepository;
  }

  async save(userCoupon: UserCoupon): Promise<UserCoupon> {
    const repository = this.getRepository();
    const entity = this.fromDomain(userCoupon);
    const savedEntity = await repository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<UserCoupon | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({
      where: { id },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCouponIdAndUserId(
    couponId: string,
    userId: string
  ): Promise<UserCoupon | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({
      where: { couponId, userId },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<UserCoupon[]> {
    const repository = this.getRepository();
    const entities = await repository.find({
      where: { userId },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  private fromDomain(userCoupon: UserCoupon): UserCouponTypeOrmEntity {
    const props = userCoupon.toPersistence();
    const entity = new UserCouponTypeOrmEntity();
    entity.id = props.id;
    entity.couponId = props.couponId;
    entity.userId = props.userId;
    entity.orderId = props.orderId;
    entity.discountPrice = props.discountPrice;
    entity.status = props.status;
    entity.issuedIdempotencyKey = props.issuedIdempotencyKey;
    entity.usedIdempotencyKey = props.usedIdempotencyKey;
    entity.expiresAt = props.expiresAt;
    entity.usedAt = props.usedAt;
    entity.cancelledAt = props.cancelledAt;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }

  private toDomain(entity: UserCouponTypeOrmEntity): UserCoupon {
    return UserCoupon.fromPersistence({
      id: entity.id,
      couponId: entity.couponId,
      userId: entity.userId,
      orderId: entity.orderId,
      discountPrice: entity.discountPrice,
      status: entity.status as UserCouponStatus,
      issuedIdempotencyKey: entity.issuedIdempotencyKey,
      usedIdempotencyKey: entity.usedIdempotencyKey,
      expiresAt: entity.expiresAt,
      usedAt: entity.usedAt,
      cancelledAt: entity.cancelledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
