import { OrderTypeOrmEntity } from "../orm/order.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import {
  TEST_FACTORY_DEFAULTS,
  createTestOrderId,
  createTestIdempotencyKey,
} from "./constants";

export const OrderFactory = createEntityFactory<OrderTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();

    const order = new OrderTypeOrmEntity();
    Object.assign(order, {
      ...baseProps,
      id: options.id || createTestOrderId(timestamp, counter),
      userId: options.userId || `user-${timestamp}-${counter}`,
      totalPrice: options.totalPrice ?? TEST_FACTORY_DEFAULTS.ORDER.TOTAL_PRICE,
      discountPrice:
        options.discountPrice ?? TEST_FACTORY_DEFAULTS.ORDER.DISCOUNT_PRICE,
      finalPrice: options.finalPrice ?? TEST_FACTORY_DEFAULTS.ORDER.FINAL_PRICE,
      status: options.status ?? TEST_FACTORY_DEFAULTS.ORDER.STATUS,
      failedReason: options.failedReason ?? null,
      idempotencyKey:
        options.idempotencyKey || createTestIdempotencyKey(timestamp, counter),
      appliedCouponId: options.appliedCouponId ?? null,
      orderItems: options.orderItems ?? [],
      ...options,
    });

    return order;
  }
);
