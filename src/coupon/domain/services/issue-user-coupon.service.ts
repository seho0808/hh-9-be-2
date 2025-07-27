import { Coupon } from "../entities/coupon.entity";
import { UserCoupon } from "../entities/user-coupon.entity";

export class IssueUserCouponDomainService {
  async issueUserCoupon({
    coupon,
    userId,
    couponCode,
    idempotencyKey,
  }: {
    coupon: Coupon;
    userId: string;
    couponCode: string;
    idempotencyKey: string;
  }): Promise<UserCoupon> {
    coupon.issue(couponCode);

    const userCoupon = UserCoupon.create({
      couponId: coupon.id,
      userId,
      expiresAt: coupon.endDate,
      issuedIdempotencyKey: idempotencyKey,
    });

    return userCoupon;
  }
}
