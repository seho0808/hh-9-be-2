import { OrderTypeOrmEntity } from "../orm/order.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const OrderFactory = createEntityFactory<OrderTypeOrmEntity>(
  (options) => {
    const baseProps = getBaseProps();

    const order = new OrderTypeOrmEntity();
    Object.assign(order, {
      ...baseProps,
      id: options.id || uuidv4(),
      userId: options.userId || uuidv4(),
      totalPrice: options.totalPrice ?? TEST_FACTORY_DEFAULTS.ORDER.TOTAL_PRICE,
      discountPrice:
        options.discountPrice ?? TEST_FACTORY_DEFAULTS.ORDER.DISCOUNT_PRICE,
      finalPrice: options.finalPrice ?? TEST_FACTORY_DEFAULTS.ORDER.FINAL_PRICE,
      status: options.status ?? TEST_FACTORY_DEFAULTS.ORDER.STATUS,
      failedReason: options.failedReason ?? null,
      idempotencyKey: options.idempotencyKey || uuidv4(),
      appliedUserCouponId: options.appliedUserCouponId ?? null,
      orderItems: options.orderItems ?? [],
      ...options,
    });

    return order;
  }
);
