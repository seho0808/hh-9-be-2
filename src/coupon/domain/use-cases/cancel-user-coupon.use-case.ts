import { Inject, Injectable } from "@nestjs/common";
import { UserCouponRepositoryInterface } from "../interfaces/user-coupon.repository.interface";
import { CouponRepositoryInterface } from "../interfaces/coupon.repository.interface";
import { UserCoupon, UserCouponStatus } from "../entities/user-coupon.entity";
import { Coupon } from "../entities/coupon.entity";
import { UserCouponNotFoundError } from "../exceptions/user-coupon.exception";
import { CouponNotFoundError } from "../exceptions/coupon.exceptions";

export interface CancelUserCouponCommand {
  userCouponId: string;
}

export interface CancelUserCouponResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class CancelUserCouponUseCase {
  constructor(
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface,
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface
  ) {}

  async execute(
    command: CancelUserCouponCommand
  ): Promise<CancelUserCouponResult> {
    const { userCouponId } = command;

    const userCoupon = await this.userCouponRepository.findById(userCouponId);
    if (!userCoupon) {
      throw new UserCouponNotFoundError(userCouponId);
    }

    const coupon = await this.couponRepository.findById(userCoupon.couponId);
    if (!coupon) {
      throw new CouponNotFoundError(userCoupon.couponId);
    }

    if (userCoupon.status === UserCouponStatus.USED) {
      userCoupon.cancel();
      coupon.cancel();
    } else {
      userCoupon.cancel();
    }

    await Promise.all([
      this.userCouponRepository.save(userCoupon),
      this.couponRepository.save(coupon),
    ]);

    return { coupon, userCoupon };
  }
}
