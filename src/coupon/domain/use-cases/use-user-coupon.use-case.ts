import { Injectable, Inject } from "@nestjs/common";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { Coupon } from "../entities/coupon.entity";
import { CouponNotFoundError } from "../exceptions/coupon.exceptions";

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
export class UserCouponUseCase {
  constructor(
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface
  ) {}

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
