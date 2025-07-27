import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { Inject, Injectable } from "@nestjs/common";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";

export interface GetCouponByIdCommand {
  couponId: string;
}

export interface GetCouponByIdResult {
  coupon: Coupon;
}

@Injectable()
export class GetCouponByIdUseCase {
  constructor(
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface
  ) {}

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
