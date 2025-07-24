import { UserCoupon } from "../entities/user-coupon.entity";

export interface UserCouponRepositoryInterface {
  save(userCoupon: UserCoupon): Promise<UserCoupon>;
  findById(id: string): Promise<UserCoupon | null>;
  findByCouponIdAndUserId(
    couponId: string,
    userId: string
  ): Promise<UserCoupon | null>;
  findByUserId(userId: string): Promise<UserCoupon[]>;
}
