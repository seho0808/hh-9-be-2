import "reflect-metadata";
import { DataSource } from "typeorm";

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_DATABASE || "testdb",
  entities: [],
  synchronize: false,
  logging: true,
});

async function cleanupOrderTestUsersAndData() {
  console.log("🧹 Cleaning up order test users and related data...");

  // 우리 스크립트는 이메일에 test.example.com, 이름에 OrderUser_ 접두어를 사용
  try {
    const deletedOrderItems = await dataSource.query(`
      DELETE FROM order_items
      WHERE order_id IN (
        SELECT id FROM orders
        WHERE user_id IN (
          SELECT id FROM users
          WHERE email LIKE '%test.example.com%'
             OR name LIKE 'OrderUser_%'
        )
      )
    `);

    const deletedOrders = await dataSource.query(`
      DELETE FROM orders
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email LIKE '%test.example.com%'
           OR name LIKE 'OrderUser_%'
      )
    `);

    const deletedPointTransactions = await dataSource.query(`
      DELETE FROM point_transactions
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email LIKE '%test.example.com%'
           OR name LIKE 'OrderUser_%'
      )
    `);

    const deletedBalances = await dataSource.query(`
      DELETE FROM user_balances
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email LIKE '%test.example.com%'
           OR name LIKE 'OrderUser_%'
      )
    `);

    const deletedUsers = await dataSource.query(`
      DELETE FROM users
      WHERE email LIKE '%test.example.com%'
         OR name LIKE 'OrderUser_%'
    `);

    console.log("✅ Cleanup completed");
    console.log(
      `   - Order Items deleted: ${deletedOrderItems.affectedRows || 0}`
    );
    console.log(`   - Orders deleted: ${deletedOrders.affectedRows || 0}`);
    console.log(
      `   - Point Transactions deleted: ${deletedPointTransactions.affectedRows || 0}`
    );
    console.log(
      `   - User Balances deleted: ${deletedBalances.affectedRows || 0}`
    );
    console.log(`   - Users deleted: ${deletedUsers.affectedRows || 0}`);
  } catch (err) {
    console.error("❌ Cleanup error:", err);
    throw err;
  }
}

async function main() {
  try {
    console.log("🚀 Starting order-test cleanup...");
    await dataSource.initialize();
    console.log("📅 Database connected");
    await cleanupOrderTestUsersAndData();
    console.log("🎉 Order-test cleanup completed!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main();
}
