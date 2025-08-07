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

  async findByIdWithLock(id: string): Promise<UserCoupon | null> {
    const entity = await this.userCouponRepository.findOne({
      where: { id },
      lock: { mode: "pessimistic_write" },
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

  async findByCouponIdAndUserIdWithLock(
    couponId: string,
    userId: string
  ): Promise<UserCoupon | null> {
    const entity = await this.userCouponRepository.findOne({
      where: { couponId, userId },
      lock: { mode: "pessimistic_write" },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<UserCoupon[]> {
    const entities = await this.userCouponRepository.find({
      where: { userId },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<UserCoupon | null> {
    const entity = await this.userCouponRepository.findOne({
      where: { issuedIdempotencyKey: idempotencyKey },
    });
    return entity ? this.toDomain(entity) : null;
  }

  private fromDomain(userCoupon: UserCoupon): UserCouponTypeOrmEntity {
    const entity = new UserCouponTypeOrmEntity();
    entity.id = userCoupon.id;
    entity.couponId = userCoupon.couponId;
    entity.userId = userCoupon.userId;
    entity.orderId = userCoupon.orderId;
    entity.discountPrice = userCoupon.discountPrice;
    entity.status = userCoupon.status;
    entity.issuedIdempotencyKey = userCoupon.issuedIdempotencyKey;
    entity.expiresAt = userCoupon.expiresAt;
    entity.usedAt = userCoupon.usedAt;
    entity.cancelledAt = userCoupon.cancelledAt;
    entity.createdAt = userCoupon.createdAt;
    entity.updatedAt = userCoupon.updatedAt;
    return entity;
  }

  private toDomain(entity: UserCouponTypeOrmEntity): UserCoupon {
    const userCouponProps = {
      id: entity.id,
      couponId: entity.couponId,
      userId: entity.userId,
      orderId: entity.orderId,
      discountPrice: entity.discountPrice,
      status: entity.status as UserCouponStatus,
      issuedIdempotencyKey: entity.issuedIdempotencyKey,
      expiresAt: entity.expiresAt,
      usedAt: entity.usedAt,
      cancelledAt: entity.cancelledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return new UserCoupon(userCouponProps);
  }
}
