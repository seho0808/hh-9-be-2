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
    return Coupon.fromPersistence({
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
    });
  }

  private fromDomain(coupon: Coupon): CouponTypeOrmEntity {
    const props = coupon.toPersistence();
    const entity = new CouponTypeOrmEntity();
    entity.id = props.id;
    entity.name = props.name;
    entity.description = props.description;
    entity.couponCode = props.couponCode;
    entity.discountType = props.discountType;
    entity.discountValue = props.discountValue;
    entity.minimumOrderPrice = props.minimumOrderPrice;
    entity.maxDiscountPrice = props.maxDiscountPrice;
    entity.issuedCount = props.issuedCount;
    entity.usedCount = props.usedCount;
    entity.totalCount = props.totalCount;
    entity.startDate = props.startDate;
    entity.endDate = props.endDate;
    entity.expiresInDays = props.expiresInDays;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }
}
