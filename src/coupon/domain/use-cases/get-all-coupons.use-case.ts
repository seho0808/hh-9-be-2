import { Injectable, Inject } from "@nestjs/common";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";

export interface GetAllCouponsResult {
  coupons: Coupon[];
}

@Injectable()
export class GetAllCouponsUseCase {
  constructor(
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface
  ) {}

  async execute(): Promise<GetAllCouponsResult> {
    const coupons = await this.couponRepository.findAll();

    return {
      coupons,
    };
  }
}
