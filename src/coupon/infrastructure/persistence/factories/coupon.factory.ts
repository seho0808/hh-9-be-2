import { CouponTypeOrmEntity } from "../orm/coupon.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import {
  TEST_FACTORY_DEFAULTS,
  createTestName,
  createTestDescription,
  createTestCouponCode,
} from "./constants";
import { v4 as uuidv4 } from "uuid";

export const CouponFactory = createEntityFactory<CouponTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();
    const now = new Date();
    const endDate = new Date(
      now.getTime() +
        TEST_FACTORY_DEFAULTS.COUPON.EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
    );

    const coupon = new CouponTypeOrmEntity();
    Object.assign(coupon, {
      ...baseProps,
      id: options.id || uuidv4(),
      name: options.name || createTestName("쿠폰", timestamp, counter),
      description:
        options.description ||
        createTestDescription("쿠폰", timestamp, counter),
      couponCode:
        options.couponCode || createTestCouponCode(timestamp, counter),
      discountType:
        options.discountType ?? TEST_FACTORY_DEFAULTS.COUPON.DISCOUNT_TYPE,
      discountValue:
        options.discountValue ?? TEST_FACTORY_DEFAULTS.COUPON.DISCOUNT_VALUE,
      minimumOrderPrice:
        options.minimumOrderPrice ??
        TEST_FACTORY_DEFAULTS.COUPON.MINIMUM_ORDER_PRICE,
      maxDiscountPrice:
        options.maxDiscountPrice ??
        TEST_FACTORY_DEFAULTS.COUPON.MAX_DISCOUNT_PRICE,
      issuedCount: options.issuedCount ?? 0,
      usedCount: options.usedCount ?? 0,
      totalCount:
        options.totalCount ?? TEST_FACTORY_DEFAULTS.COUPON.TOTAL_COUNT,
      startDate: options.startDate ?? now,
      endDate: options.endDate ?? endDate,
      expiresInDays:
        options.expiresInDays ?? TEST_FACTORY_DEFAULTS.COUPON.EXPIRES_IN_DAYS,
      ...options,
    });

    return coupon;
  }
);
