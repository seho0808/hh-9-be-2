import { UserBalanceTypeOrmEntity } from "../orm/user-balance.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "@/common/factories/base.factory";
import { TEST_FACTORY_DEFAULTS } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const UserBalanceFactory = createEntityFactory<UserBalanceTypeOrmEntity>(
  (options) => {
    const baseProps = getBaseProps();

    const userBalance = new UserBalanceTypeOrmEntity();
    Object.assign(userBalance, {
      ...baseProps,
      id: options.id || uuidv4(),
      userId: options.userId || uuidv4(),
      balance: options.balance ?? TEST_FACTORY_DEFAULTS.USER_BALANCE.BALANCE,
      ...options,
    });

    return userBalance;
  }
);
