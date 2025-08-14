import { OrderItemTypeOrmEntity } from "../orm/order-item.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/infrastructure/base.factory";
import { TEST_FACTORY_DEFAULTS } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const OrderItemFactory = createEntityFactory<OrderItemTypeOrmEntity>(
  (options) => {
    const baseProps = getBaseProps();

    const orderItem = new OrderItemTypeOrmEntity();
    Object.assign(orderItem, {
      ...baseProps,
      id: options.id || uuidv4(),
      orderId: options.orderId || uuidv4(),
      productId: options.productId || uuidv4(),
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
