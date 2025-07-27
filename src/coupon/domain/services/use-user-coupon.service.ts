import { Coupon } from "../entities/coupon.entity";
import { UserCoupon } from "../entities/user-coupon.entity";

export class UseUserCouponDomainService {
  async useUserCoupon({
    coupon,
    userCoupon,
    orderPrice,
    orderId,
    idempotencyKey,
  }: {
    coupon: Coupon;
    userCoupon: UserCoupon;
    orderPrice: number;
    orderId: string;
    idempotencyKey: string;
  }): Promise<{
    discountPrice: number;
    discountedPrice: number;
  }> {
    const { discountPrice, discountedPrice } = coupon.use(orderPrice);
    userCoupon.use(orderId, discountPrice, idempotencyKey);

    return {
      discountPrice,
      discountedPrice,
    };
  }
}
