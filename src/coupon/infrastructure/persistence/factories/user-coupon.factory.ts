import { UserCouponTypeOrmEntity } from "../orm/user-coupon.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS, createTestName } from "./constants";

export const UserCouponFactory = createEntityFactory<UserCouponTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        TEST_FACTORY_DEFAULTS.USER_COUPON.EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
    );

    const userCoupon = new UserCouponTypeOrmEntity();
    Object.assign(userCoupon, {
      ...baseProps,
      couponId: options.couponId || createTestName("쿠폰", timestamp, counter),
      userId: options.userId || createTestName("사용자", timestamp, counter),
      orderId: options.orderId ?? null,
      discountPrice: options.discountPrice ?? null,
      status: options.status ?? TEST_FACTORY_DEFAULTS.USER_COUPON.STATUS,
      expiresAt: options.expiresAt ?? expiresAt,
      usedAt: options.usedAt ?? null,
      cancelledAt: options.cancelledAt ?? null,
      ...options,
    });

    return userCoupon;
  }
);
