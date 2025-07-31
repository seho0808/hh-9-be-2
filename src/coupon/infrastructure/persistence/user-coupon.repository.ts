import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserCouponTypeOrmEntity } from "./orm/user-coupon.typeorm.entity";

@Injectable()
export class UserCouponRepository {
  constructor(
    @InjectRepository(UserCouponTypeOrmEntity)
    private readonly userCouponRepository: Repository<UserCouponTypeOrmEntity>
  ) {}

  async save(userCoupon: UserCoupon): Promise<UserCoupon> {
    const entity = this.fromDomain(userCoupon);
    const savedEntity = await this.userCouponRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<UserCoupon | null> {
    const entity = await this.userCouponRepository.findOne({
      where: { id },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCouponIdAndUserId(
    couponId: string,
    userId: string
  ): Promise<UserCoupon | null> {
    const entity = await this.userCouponRepository.findOne({
      where: { couponId, userId },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<UserCoupon[]> {
    const entities = await this.userCouponRepository.find({
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
