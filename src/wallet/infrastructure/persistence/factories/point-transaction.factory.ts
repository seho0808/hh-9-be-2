import { PointTransactionTypeOrmEntity } from "../orm/point-transaction.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "@/common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS, createTestTransactionId } from "./constants";

export const PointTransactionFactory =
  createEntityFactory<PointTransactionTypeOrmEntity>((options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();

    const transaction = new PointTransactionTypeOrmEntity();
    Object.assign(transaction, {
      ...baseProps,
      id: options.id || createTestTransactionId(timestamp, counter),
      userId: options.userId || `user-${timestamp}-${counter}`,
      amount: options.amount ?? TEST_FACTORY_DEFAULTS.POINT_TRANSACTION.AMOUNT,
      type: options.type ?? TEST_FACTORY_DEFAULTS.POINT_TRANSACTION.TYPE,
      ...options,
    });

    return transaction;
  });
