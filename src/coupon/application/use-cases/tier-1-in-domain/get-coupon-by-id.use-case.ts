import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { Injectable } from "@nestjs/common";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";

export interface GetCouponByIdCommand {
  couponId: string;
}

export interface GetCouponByIdResult {
  coupon: Coupon;
}

@Injectable()
export class GetCouponByIdUseCase {
  constructor(private readonly couponRepository: CouponRepository) {}

  async execute(command: GetCouponByIdCommand): Promise<GetCouponByIdResult> {
    const { couponId } = command;

    const coupon = await this.couponRepository.findById(couponId);

    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    return {
      coupon,
    };
  }
}
