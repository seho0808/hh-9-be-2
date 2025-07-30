import { Coupon } from "../entities/coupon.entity";
import { UserCoupon } from "../entities/user-coupon.entity";

export class ValidateUserCouponService {
  validateUserCoupon({
    coupon,
    userCoupon,
    orderPrice,
  }: {
    coupon: Coupon;
    userCoupon: UserCoupon;
    orderPrice: number;
  }): boolean {
    if (!coupon.canUse(orderPrice) || !userCoupon.canUse()) {
      return false;
    }
    return true;
  }
}
