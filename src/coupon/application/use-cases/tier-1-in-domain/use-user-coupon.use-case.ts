import { Injectable } from "@nestjs/common";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { Transactional } from "typeorm-transactional";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface UseUserCouponCommand {
  couponId: string;
  userId: string;
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
    const { couponId, userId, orderId, orderPrice } = command;

    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    const userCoupon = await this.userCouponRepository.findByCouponIdAndUserId(
      couponId,
      userId
    );

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
