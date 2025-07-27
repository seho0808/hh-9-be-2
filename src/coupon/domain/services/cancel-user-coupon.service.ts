import { UserCoupon, UserCouponStatus } from "../entities/user-coupon.entity";
import { Coupon } from "../entities/coupon.entity";

export class CancelUserCouponDomainService {
  async cancelUserCoupon(
    userCoupon: UserCoupon,
    coupon: Coupon
  ): Promise<void> {
    if (userCoupon.status === UserCouponStatus.USED) {
      userCoupon.cancel();
      coupon.cancel();
    } else {
      userCoupon.cancel();
    }
  }
}
