import { Injectable } from "@nestjs/common";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import {
  UserCouponNotFoundError,
  CouponNotFoundError,
} from "@/coupon/application/coupon.application.exceptions";
import { Transactional } from "typeorm-transactional";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

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
    private readonly userCouponRepository: UserCouponRepository,
    private readonly couponRepository: CouponRepository
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
