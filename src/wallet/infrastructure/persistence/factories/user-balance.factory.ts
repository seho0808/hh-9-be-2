import { UserBalanceTypeOrmEntity } from "../orm/user-balance.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "@/common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS, createTestBalanceId } from "./constants";

export const UserBalanceFactory = createEntityFactory<UserBalanceTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();

    const userBalance = new UserBalanceTypeOrmEntity();
    Object.assign(userBalance, {
      ...baseProps,
      id: options.id || createTestBalanceId(timestamp, counter),
      userId: options.userId || `user-${timestamp}-${counter}`,
      balance: options.balance ?? TEST_FACTORY_DEFAULTS.USER_BALANCE.BALANCE,
      ...options,
    });

    return userBalance;
  }
);
