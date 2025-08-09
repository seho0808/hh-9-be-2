import { PointTransactionTypeOrmEntity } from "../orm/point-transaction.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "@/common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const PointTransactionFactory =
  createEntityFactory<PointTransactionTypeOrmEntity>((options) => {
    const baseProps = getBaseProps();

    const transaction = new PointTransactionTypeOrmEntity();
    Object.assign(transaction, {
      ...baseProps,
      id: options.id || uuidv4(),
      userId: options.userId || uuidv4(),
      amount: options.amount ?? TEST_FACTORY_DEFAULTS.POINT_TRANSACTION.AMOUNT,
      type: options.type ?? TEST_FACTORY_DEFAULTS.POINT_TRANSACTION.TYPE,
      ...options,
    });

    return transaction;
  });
