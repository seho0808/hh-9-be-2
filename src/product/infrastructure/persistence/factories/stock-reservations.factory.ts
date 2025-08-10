import { StockReservationTypeOrmEntity } from "../orm/stock-reservations.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/infrastructure/base.factory";
import { TEST_FACTORY_DEFAULTS } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const StockReservationFactory =
  createEntityFactory<StockReservationTypeOrmEntity>((options) => {
    const baseProps = getBaseProps();
    const now = new Date();

    const reservation = new StockReservationTypeOrmEntity();
    Object.assign(reservation, {
      ...baseProps,
      productId: options.productId || uuidv4(),
      userId: options.userId || uuidv4(),
      orderId: options.orderId || uuidv4(),
      quantity:
        options.quantity ?? TEST_FACTORY_DEFAULTS.STOCK_RESERVATION.QUANTITY,
      status: options.status ?? TEST_FACTORY_DEFAULTS.STOCK_RESERVATION.STATUS,
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
