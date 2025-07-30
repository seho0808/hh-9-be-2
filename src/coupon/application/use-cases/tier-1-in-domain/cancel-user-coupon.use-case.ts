import { Inject, Injectable } from "@nestjs/common";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCouponNotFoundError } from "@/coupon/domain/exceptions/user-coupon.exception";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { Transactional } from "typeorm-transactional";

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

  @Transactional()
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

    if (userCoupon.isUsed()) {
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
