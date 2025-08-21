import { UserTypeOrmEntity } from "../orm/user.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/infrastructure/base.factory";
import {
  TEST_FACTORY_DEFAULTS,
  createTestName,
  createTestEmail,
} from "./constants";
import { v4 as uuidv4 } from "uuid";

export const UserFactory = createEntityFactory<UserTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();

    const user = new UserTypeOrmEntity();
    Object.assign(user, {
      ...baseProps,
      id: options.id || uuidv4(),
      email: options.email || createTestEmail(timestamp, counter),
      password: options.password || TEST_FACTORY_DEFAULTS.USER.PASSWORD,
      name:
        options.name ||
        createTestName(
          TEST_FACTORY_DEFAULTS.USER.NAME_PREFIX,
          timestamp,
          counter
        ),
      ...options,
    });

    return user;
  }
);
