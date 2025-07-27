import { Coupon } from "../entities/coupon.entity";
import { UserCoupon } from "../entities/user-coupon.entity";

export class ValidateUserCouponDomainService {
  async validateUserCoupon({
    coupon,
    userCoupon,
    orderPrice,
  }: {
    coupon: Coupon;
    userCoupon: UserCoupon;
    orderPrice: number;
  }): Promise<{
    isValid: boolean;
    discountPrice: number;
    discountedPrice: number;
  }> {
    if (!coupon.canUse(orderPrice)) {
      return {
        isValid: false,
        discountPrice: 0,
        discountedPrice: orderPrice,
      };
    }

    if (!userCoupon.canUse()) {
      return {
        isValid: false,
        discountPrice: 0,
        discountedPrice: orderPrice,
      };
    }

    const { discountPrice, discountedPrice } = coupon.use(orderPrice);

    return {
      isValid: true,
      discountPrice,
      discountedPrice,
    };
  }
}
