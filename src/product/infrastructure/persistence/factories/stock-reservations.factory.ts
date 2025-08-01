import { StockReservationTypeOrmEntity } from "../orm/stock-reservations.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS, createTestName } from "./constants";

export const StockReservationFactory =
  createEntityFactory<StockReservationTypeOrmEntity>((options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();
    const now = new Date();

    const reservation = new StockReservationTypeOrmEntity();
    Object.assign(reservation, {
      ...baseProps,
      productId:
        options.productId || createTestName("상품", timestamp, counter),
      userId: options.userId || createTestName("사용자", timestamp, counter),
      orderId: options.orderId || createTestName("주문", timestamp, counter),
      quantity:
        options.quantity ?? TEST_FACTORY_DEFAULTS.STOCK_RESERVATION.QUANTITY,
      isActive:
        options.isActive ?? TEST_FACTORY_DEFAULTS.STOCK_RESERVATION.IS_ACTIVE,
      expiresAt:
        options.expiresAt ||
        new Date(
          now.getTime() +
            TEST_FACTORY_DEFAULTS.STOCK_RESERVATION.EXPIRATION_TIME
        ),
      ...options,
    });

    return reservation;
  });
