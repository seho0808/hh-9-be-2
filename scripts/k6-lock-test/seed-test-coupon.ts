import "reflect-metadata";
import { DataSource } from "typeorm";
import { CouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { UserTypeOrmEntity } from "../../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { OrderTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { CouponFactory } from "../../src/coupon/infrastructure/persistence/factories/coupon.factory";

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_DATABASE || "testdb",
  entities: [
    CouponTypeOrmEntity,
    UserCouponTypeOrmEntity,
    UserTypeOrmEntity,
    UserBalanceTypeOrmEntity,
    PointTransactionTypeOrmEntity,
    OrderTypeOrmEntity,
    OrderItemTypeOrmEntity,
    ProductTypeOrmEntity,
  ],
  synchronize: false,
  logging: true,
});

async function cleanupTestData() {
  console.log("🧹 Cleaning up existing test data...");

  await dataSource.query(
    "DELETE FROM user_coupons WHERE coupon_id LIKE 'test-coupon-%'"
  );
  await dataSource.query("DELETE FROM coupons WHERE id LIKE 'test-coupon-%'");
  await dataSource.query(
    "DELETE FROM point_transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test.example.com')"
  );
  await dataSource.query(
    "DELETE FROM user_balances WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test.example.com')"
  );
  await dataSource.query(
    "DELETE FROM users WHERE email LIKE '%test.example.com'"
  );

  console.log("✅ Cleanup completed");
}

async function seedTestCoupon() {
  console.log("🌱 Seeding test coupon...");

  const couponRepository = dataSource.getRepository(CouponTypeOrmEntity);

  const testCoupon = CouponFactory.create({
    id: "test-coupon-1",
    name: "K6 Load Test Coupon",
    description: "High-capacity coupon for K6 load testing",
    couponCode: "K6LOADTEST",
    discountType: "FIXED",
    discountValue: 5000,
    minimumOrderPrice: 10000,
    maxDiscountPrice: null,
    totalCount: 10000,
    issuedCount: 0,
    usedCount: 0,
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    expiresInDays: 7,
  });

  await couponRepository.save(testCoupon);

  console.log("✅ Test coupon seeded successfully");
  console.log(`   - Coupon ID: ${testCoupon.id}`);
  console.log(`   - Total Count: ${testCoupon.totalCount}`);
  console.log(`   - Valid Until: ${testCoupon.endDate}`);
}

async function main() {
  try {
    console.log("🚀 Starting test data setup...");

    await dataSource.initialize();
    console.log("📅 Database connected");

    await cleanupTestData();

    await seedTestCoupon();

    console.log("🎉 Test data setup completed successfully!");
    console.log("");
    console.log("📋 Next steps:");
    console.log("  1. Start your NestJS application: npm run start:dev");
    console.log("  2. Run K6 load test with desired strategy:");
    console.log("     npm run k6:coupon:database");
    console.log("     npm run k6:coupon:spinlock");
    console.log("     npm run k6:coupon:pubsub");
    console.log("     npm run k6:coupon:queue");
    console.log("     npm run k6:coupon:fencing");
    console.log("     npm run k6:coupon:redlock");
  } catch (error) {
    console.error("❌ Error during setup:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main();
}
