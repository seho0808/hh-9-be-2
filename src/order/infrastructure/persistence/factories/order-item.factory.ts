import { OrderItemTypeOrmEntity } from "../orm/order-item.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import {
  TEST_FACTORY_DEFAULTS,
  createTestOrderItemId,
  createTestOrderId,
} from "./constants";

export const OrderItemFactory = createEntityFactory<OrderItemTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();

    const orderItem = new OrderItemTypeOrmEntity();
    Object.assign(orderItem, {
      ...baseProps,
      id: options.id || createTestOrderItemId(timestamp, counter),
      orderId: options.orderId || createTestOrderId(timestamp, counter),
      productId: options.productId || `product-${timestamp}-${counter}`,
      quantity: options.quantity ?? TEST_FACTORY_DEFAULTS.ORDER_ITEM.QUANTITY,
      unitPrice:
        options.unitPrice ?? TEST_FACTORY_DEFAULTS.ORDER_ITEM.UNIT_PRICE,
      totalPrice:
        options.totalPrice ??
        (options.quantity ?? 1) *
          (options.unitPrice ?? TEST_FACTORY_DEFAULTS.ORDER_ITEM.UNIT_PRICE),
      ...options,
    });

    return orderItem;
  }
);
