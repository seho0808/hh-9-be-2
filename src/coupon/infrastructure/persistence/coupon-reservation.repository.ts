import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CouponReservationTypeOrmEntity } from "./orm/coupon-reservation.typeorm.entity";
import {
  CouponReservation,
  CouponReservationStatus,
} from "@/coupon/domain/entities/coupon-reservation.entity";

@Injectable()
export class CouponReservationRepository {
  constructor(
    @InjectRepository(CouponReservationTypeOrmEntity)
    private readonly couponReservationRepository: Repository<CouponReservationTypeOrmEntity>
  ) {}

  async save(couponReservation: CouponReservation): Promise<CouponReservation> {
    const entity = this.fromDomain(couponReservation);
    const savedEntity = await this.couponReservationRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<CouponReservation | null> {
    const entity = await this.couponReservationRepository.findOne({
      where: { id },
    });
    return entity ? this.toDomain(entity) : null;
  }

  private fromDomain(
    couponReservation: CouponReservation
  ): CouponReservationTypeOrmEntity {
    const entity = new CouponReservationTypeOrmEntity();
    entity.couponId = couponReservation.couponId;
    entity.userId = couponReservation.userId;
    entity.couponCode = couponReservation.couponCode;
    entity.idempotencyKey = couponReservation.idempotencyKey;
    entity.status = couponReservation.status;
    entity.expiresAt = couponReservation.expiresAt;
    entity.createdAt = couponReservation.createdAt;
    entity.updatedAt = couponReservation.updatedAt;
    return entity;
  }

  private toDomain(entity: CouponReservationTypeOrmEntity): CouponReservation {
    const couponReservationProps = {
      id: entity.id,
      couponId: entity.couponId,
      userId: entity.userId,
      couponCode: entity.couponCode,
      idempotencyKey: entity.idempotencyKey,
      status: entity.status as CouponReservationStatus,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return new CouponReservation(couponReservationProps);
  }
}
