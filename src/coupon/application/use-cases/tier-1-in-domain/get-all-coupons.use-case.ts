import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";

export interface GetAllCouponsResult {
  coupons: Coupon[];
}

@Injectable()
export class GetAllCouponsUseCase {
  constructor(private readonly couponRepository: CouponRepository) {}

  async execute(): Promise<GetAllCouponsResult> {
    const coupons = await this.couponRepository.findAll();

    return {
      coupons,
    };
  }
}
