import { UserTypeOrmEntity } from "../../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { CouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { OrderTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";

export const ALL_ENTITIES = [
  UserTypeOrmEntity,
  ProductTypeOrmEntity,
  StockReservationTypeOrmEntity,
  CouponTypeOrmEntity,
  UserCouponTypeOrmEntity,
  UserBalanceTypeOrmEntity,
  PointTransactionTypeOrmEntity,
  OrderTypeOrmEntity,
  OrderItemTypeOrmEntity,
];

export const TABLE_NAMES = [
  "users",
  "products",
  "stock_reservations",
  "coupons",
  "user_coupons",
  "user_balances",
  "point_transactions",
  "orders",
  "order_items",
];

export const DEFAULT_TEST_USER = {
  id: "user-123",
  email: "test@example.com",
  rawPassword: "testPassword123",
  name: "테스트 사용자",
};

export const DEFAULT_CONTAINER_CONFIG = {
  mysqlVersion: "mysql:8.0",
  redisVersion: "redis:7-alpine",
  username: "test_user",
  password: "test_password",
};
