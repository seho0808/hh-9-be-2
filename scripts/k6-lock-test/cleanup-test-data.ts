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

async function cleanupAllTestData() {
  console.log("🧹 Starting comprehensive cleanup of test data...");

  try {
    const userCouponCount = await dataSource.query(
      "SELECT COUNT(*) as count FROM user_coupons WHERE coupon_id LIKE 'test-coupon-%' OR coupon_id LIKE '%K6%'"
    );
    const testUserCount = await dataSource.query(
      "SELECT COUNT(*) as count FROM users WHERE email LIKE '%test.example.com' OR email LIKE '%k6user%'"
    );
    const testCouponCount = await dataSource.query(
      "SELECT COUNT(*) as count FROM coupons WHERE id LIKE 'test-coupon-%' OR coupon_code LIKE '%K6%' OR coupon_code LIKE '%TEST%'"
    );

    console.log(`📊 Found test data:`);
    console.log(`   - User Coupons: ${userCouponCount[0].count}`);
    console.log(`   - Test Users: ${testUserCount[0].count}`);
    console.log(`   - Test Coupons: ${testCouponCount[0].count}`);

    console.log("🗑️  Deleting user coupons...");
    const deletedUserCoupons = await dataSource.query(`
      DELETE FROM user_coupons 
      WHERE coupon_id LIKE 'test-coupon-%' 
         OR coupon_id LIKE '%K6%'
         OR user_id IN (
           SELECT id FROM users 
           WHERE email LIKE '%test.example.com' 
              OR email LIKE '%k6user%'
         )
    `);

    console.log("🗑️  Deleting point transactions...");
    const deletedPointTransactions = await dataSource.query(`
      DELETE FROM point_transactions 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%test.example.com' 
           OR email LIKE '%k6user%'
      )
    `);

    console.log("🗑️  Deleting user balances...");
    const deletedUserBalances = await dataSource.query(`
      DELETE FROM user_balances 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%test.example.com' 
           OR email LIKE '%k6user%'
      )
    `);

    console.log("🗑️  Deleting test users...");
    const deletedUsers = await dataSource.query(`
      DELETE FROM users 
      WHERE email LIKE '%test.example.com' 
         OR email LIKE '%k6user%'
         OR name LIKE '%K6TestUser%'
         OR name LIKE '%테스트사용자%'
    `);

    console.log("🗑️  Deleting test coupons...");
    const deletedCoupons = await dataSource.query(`
      DELETE FROM coupons 
      WHERE id LIKE 'test-coupon-%' 
         OR coupon_code LIKE '%K6%' 
         OR coupon_code LIKE '%TEST%'
         OR name LIKE '%K6 Load Test%'
         OR name LIKE '%테스트 쿠폰%'
    `);

    console.log("✅ Cleanup completed successfully!");
    console.log(`📊 Cleanup summary:`);
    console.log(
      `   - User Coupons deleted: ${deletedUserCoupons.affectedRows || 0}`
    );
    console.log(
      `   - Point Transactions deleted: ${deletedPointTransactions.affectedRows || 0}`
    );
    console.log(
      `   - User Balances deleted: ${deletedUserBalances.affectedRows || 0}`
    );
    console.log(`   - Users deleted: ${deletedUsers.affectedRows || 0}`);
    console.log(`   - Coupons deleted: ${deletedCoupons.affectedRows || 0}`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

async function resetCouponCounts() {
  console.log("🔄 Resetting test coupon counts...");

  try {
    const resetResult = await dataSource.query(`
      UPDATE coupons 
      SET issued_count = 0, used_count = 0, updated_at = NOW()
      WHERE id LIKE 'test-coupon-%' 
         OR coupon_code LIKE '%K6%' 
         OR coupon_code LIKE '%TEST%'
    `);

    console.log(`✅ Reset ${resetResult.affectedRows || 0} coupon counts`);
  } catch (error) {
    console.error("❌ Error resetting coupon counts:", error);
    throw error;
  }
}

async function main() {
  const command = process.argv[2] || "full";

  try {
    console.log("🚀 Starting cleanup process...");

    await dataSource.initialize();
    console.log("📅 Database connected");

    switch (command) {
      case "full":
        await cleanupAllTestData();
        break;
      case "reset":
        await resetCouponCounts();
        break;
      case "users":
        console.log("🗑️  Cleaning up test users only...");
        await dataSource.query(`
          DELETE FROM point_transactions 
          WHERE user_id IN (
            SELECT id FROM users 
            WHERE email LIKE '%test.example.com' 
               OR email LIKE '%k6user%'
          )
        `);
        await dataSource.query(`
          DELETE FROM user_balances 
          WHERE user_id IN (
            SELECT id FROM users 
            WHERE email LIKE '%test.example.com' 
               OR email LIKE '%k6user%'
          )
        `);
        await dataSource.query(`
          DELETE FROM users 
          WHERE email LIKE '%test.example.com' 
             OR email LIKE '%k6user%'
             OR name LIKE '%K6TestUser%'
             OR name LIKE '%테스트사용자%'
        `);
        console.log("✅ Test users cleaned up");
        break;
      default:
        console.log(
          "❓ Unknown command. Available commands: full, reset, users"
        );
        process.exit(1);
    }

    console.log("🎉 Cleanup process completed!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main();
}
