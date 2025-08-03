import { UserCouponTypeOrmEntity } from "../orm/user-coupon.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const UserCouponFactory = createEntityFactory<UserCouponTypeOrmEntity>(
  (options) => {
    const baseProps = getBaseProps();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        TEST_FACTORY_DEFAULTS.USER_COUPON.EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
    );

    const userCoupon = new UserCouponTypeOrmEntity();
    Object.assign(userCoupon, {
      ...baseProps,
      couponId: options.couponId || uuidv4(),
      userId: options.userId || uuidv4(),
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
