import { Injectable } from "@nestjs/common";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { CouponNotFoundError } from "@/coupon/application/coupon.application.exceptions";
import { Transactional } from "typeorm-transactional";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface UseUserCouponCommand {
  userCouponId: string;
  orderId: string;
  orderPrice: number;
}

export interface UseUserCouponResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
  discountPrice: number;
  discountedPrice: number;
}

@Injectable()
export class UseUserCouponUseCase {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly userCouponRepository: UserCouponRepository
  ) {}

  @Transactional()
  async execute(command: UseUserCouponCommand): Promise<UseUserCouponResult> {
    const { userCouponId, orderId, orderPrice } = command;

    const userCoupon = await this.userCouponRepository.findById(userCouponId);
    if (!userCoupon) {
      throw new CouponNotFoundError(userCouponId);
    }

    const coupon = await this.couponRepository.findById(userCoupon.couponId);

    const { discountPrice, discountedPrice } = coupon.use(orderPrice);
    userCoupon.use(orderId, discountPrice);

    await Promise.all([
      this.couponRepository.save(coupon),
      this.userCouponRepository.save(userCoupon),
    ]);

    return {
      coupon,
      userCoupon,
      discountPrice,
      discountedPrice,
    };
  }
}
