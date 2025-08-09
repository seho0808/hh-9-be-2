import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Coupon,
  CouponDiscountType,
} from "@/coupon/domain/entities/coupon.entity";
import { CouponTypeOrmEntity } from "./orm/coupon.typeorm.entity";

@Injectable()
export class CouponRepository {
  constructor(
    @InjectRepository(CouponTypeOrmEntity)
    private readonly couponRepository: Repository<CouponTypeOrmEntity>
  ) {}

  async findById(id: string): Promise<Coupon | null> {
    const entity = await this.couponRepository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIdWithLock(id: string): Promise<Coupon | null> {
    const entity = await this.couponRepository.findOne({
      where: { id },
      lock: { mode: "pessimistic_write" },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Coupon[]> {
    const entities = await this.couponRepository.find();
    return entities.map((entity) => this.toDomain(entity));
  }

  async save(coupon: Coupon): Promise<Coupon> {
    const entity = this.fromDomain(coupon);
    const savedEntity = await this.couponRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  private toDomain(entity: CouponTypeOrmEntity): Coupon {
    const couponProps = {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      couponCode: entity.couponCode,
      discountType:
        entity.discountType === "FIXED"
          ? CouponDiscountType.FIXED
          : CouponDiscountType.PERCENTAGE,
      discountValue: entity.discountValue,
      minimumOrderPrice: entity.minimumOrderPrice,
      maxDiscountPrice: entity.maxDiscountPrice,
      issuedCount: entity.issuedCount,
      usedCount: entity.usedCount,
      totalCount: entity.totalCount,
      startDate: entity.startDate,
      endDate: entity.endDate,
      expiresInDays: entity.expiresInDays,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return new Coupon(couponProps);
  }

  private fromDomain(coupon: Coupon): CouponTypeOrmEntity {
    const entity = new CouponTypeOrmEntity();
    entity.id = coupon.id;
    entity.name = coupon.name;
    entity.description = coupon.description;
    entity.couponCode = coupon.couponCode;
    entity.discountType = coupon.discountType;
    entity.discountValue = coupon.discountValue;
    entity.minimumOrderPrice = coupon.minimumOrderPrice;
    entity.maxDiscountPrice = coupon.maxDiscountPrice;
    entity.issuedCount = coupon.issuedCount;
    entity.usedCount = coupon.usedCount;
    entity.totalCount = coupon.totalCount;
    entity.startDate = coupon.startDate;
    entity.endDate = coupon.endDate;
    entity.expiresInDays = coupon.expiresInDays;
    entity.createdAt = coupon.createdAt;
    entity.updatedAt = coupon.updatedAt;
    return entity;
  }
}
