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
import Redis from "ioredis";

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

// Redis 클라이언트 설정
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
});

async function cleanupCacheTestDatabase() {
  console.log("🧹 Cleaning up cache test database data...");

  try {
    // 데이터 개수 확인
    const orderItemCount = await dataSource.query(`
      SELECT COUNT(*) as count FROM order_items 
      WHERE order_id IN (
        SELECT id FROM orders 
        WHERE user_id IN (
          SELECT id FROM users 
          WHERE email LIKE '%cachetest.example.com' 
             OR email LIKE '%cacheuser%' 
             OR email LIKE '%mixeduser%'
        )
      )
    `);

    const orderCount = await dataSource.query(`
      SELECT COUNT(*) as count FROM orders 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%cachetest.example.com' 
           OR email LIKE '%cacheuser%' 
           OR email LIKE '%mixeduser%'
      )
    `);

    const userCount = await dataSource.query(`
      SELECT COUNT(*) as count FROM users 
      WHERE email LIKE '%cachetest.example.com' 
         OR email LIKE '%cacheuser%' 
         OR email LIKE '%mixeduser%'
    `);

    const productCount = await dataSource.query(`
      SELECT COUNT(*) as count FROM products 
      WHERE id LIKE 'cache-test-product-%'
    `);

    console.log(`📊 Found cache test data (optimized for cache comparison):`);
    console.log(`   - Order Items: ${orderItemCount[0].count}`);
    console.log(`   - Orders: ${orderCount[0].count}`);
    console.log(`   - Users: ${userCount[0].count}`);
    console.log(`   - Products: ${productCount[0].count}`);

    // 순서대로 삭제 (FK 제약 조건 고려)
    console.log("🗑️  Deleting order items...");
    const deletedOrderItems = await dataSource.query(`
      DELETE FROM order_items 
      WHERE order_id IN (
        SELECT id FROM orders 
        WHERE user_id IN (
          SELECT id FROM users 
          WHERE email LIKE '%cachetest.example.com' 
             OR email LIKE '%cacheuser%' 
             OR email LIKE '%mixeduser%'
        )
      )
    `);

    console.log("🗑️  Deleting orders...");
    const deletedOrders = await dataSource.query(`
      DELETE FROM orders 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%cachetest.example.com' 
           OR email LIKE '%cacheuser%' 
           OR email LIKE '%mixeduser%'
      )
    `);

    console.log("🗑️  Deleting point transactions...");
    const deletedPointTransactions = await dataSource.query(`
      DELETE FROM point_transactions 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%cachetest.example.com' 
           OR email LIKE '%cacheuser%' 
           OR email LIKE '%mixeduser%'
      )
    `);

    console.log("🗑️  Deleting user balances...");
    const deletedUserBalances = await dataSource.query(`
      DELETE FROM user_balances 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%cachetest.example.com' 
           OR email LIKE '%cacheuser%' 
           OR email LIKE '%mixeduser%'
      )
    `);

    console.log("🗑️  Deleting cache test users...");
    const deletedUsers = await dataSource.query(`
      DELETE FROM users 
      WHERE email LIKE '%cachetest.example.com' 
         OR email LIKE '%cacheuser%' 
         OR email LIKE '%mixeduser%'
         OR name LIKE '%Cache Test User%'
         OR name LIKE '%MixedTestUser%'
         OR name LIKE '%CacheTestUser%'
    `);

    console.log("🗑️  Deleting cache test products...");
    const deletedProducts = await dataSource.query(`
      DELETE FROM products 
      WHERE id LIKE 'cache-test-product-%'
         OR name LIKE '%cache testing%'
    `);

    console.log("✅ Database cleanup completed!");
    console.log(`📊 Database cleanup summary:`);
    console.log(
      `   - Order Items deleted: ${deletedOrderItems.affectedRows || 0}`
    );
    console.log(`   - Orders deleted: ${deletedOrders.affectedRows || 0}`);
    console.log(
      `   - Point Transactions deleted: ${deletedPointTransactions.affectedRows || 0}`
    );
    console.log(
      `   - User Balances deleted: ${deletedUserBalances.affectedRows || 0}`
    );
    console.log(`   - Users deleted: ${deletedUsers.affectedRows || 0}`);
    console.log(`   - Products deleted: ${deletedProducts.affectedRows || 0}`);
  } catch (error) {
    console.error("❌ Error during database cleanup:", error);
    throw error;
  }
}

async function cleanupCacheTestRedisData() {
  console.log("🧹 Cleaning up cache test Redis data...");

  try {
    // 캐시 키 패턴들
    const cacheKeyPatterns = [
      "popular:products:*",
      "user:orders:cache-test-user-*",
      "product:details:cache-test-product-*",
      "user:orders:*", // 테스트 중 생성된 임시 사용자 캐시들도 정리
    ];

    let totalDeletedKeys = 0;

    for (const pattern of cacheKeyPatterns) {
      console.log(`🗑️  Scanning for keys matching: ${pattern}`);

      const keys = await redis.keys(pattern);
      console.log(`   Found ${keys.length} keys`);

      if (keys.length > 0) {
        // 배치로 삭제 (성능 향상)
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redis.del(...batch);
        }
        totalDeletedKeys += keys.length;
        console.log(`   Deleted ${keys.length} keys`);
      }
    }

    // 통계 관련 캐시도 정리
    console.log("🗑️  Cleaning up cache statistics...");
    const statsKeys = await redis.keys("stats:*");
    if (statsKeys.length > 0) {
      await redis.del(...statsKeys);
      totalDeletedKeys += statsKeys.length;
      console.log(`   Deleted ${statsKeys.length} statistics keys`);
    }

    console.log("✅ Redis cache cleanup completed!");
    console.log(`📊 Redis cleanup summary:`);
    console.log(`   - Total cache keys deleted: ${totalDeletedKeys}`);
  } catch (error) {
    console.error("❌ Error during Redis cleanup:", error);
    throw error;
  }
}

async function flushAllCaches() {
  console.log("🔄 Flushing all Redis caches...");

  try {
    await redis.flushdb();
    console.log("✅ All Redis caches flushed");
  } catch (error) {
    console.error("❌ Error flushing Redis caches:", error);
    throw error;
  }
}

async function showCacheStatistics() {
  console.log("📊 Current cache statistics...");

  try {
    // Redis 통계
    const redisInfo = await redis.info("memory");
    const memorySection = redisInfo
      .split("\r\n")
      .filter(
        (line) =>
          line.startsWith("used_memory_human:") ||
          line.startsWith("used_memory_peak_human:")
      );

    console.log("📈 Redis Memory Usage:");
    memorySection.forEach((line) => {
      const [key, value] = line.split(":");
      console.log(`   ${key.replace("_", " ")}: ${value}`);
    });

    // 키 개수 통계
    const allKeys = await redis.keys("*");
    const cacheKeys = allKeys.filter(
      (key) =>
        key.startsWith("popular:") ||
        key.startsWith("user:orders:") ||
        key.startsWith("product:details:")
    );

    console.log("🔑 Cache Keys Summary:");
    console.log(`   Total Redis keys: ${allKeys.length}`);
    console.log(`   Cache-related keys: ${cacheKeys.length}`);

    // 카테고리별 캐시 키 개수
    const popularKeys = allKeys.filter((key) =>
      key.startsWith("popular:")
    ).length;
    const userOrderKeys = allKeys.filter((key) =>
      key.startsWith("user:orders:")
    ).length;
    const productDetailKeys = allKeys.filter((key) =>
      key.startsWith("product:details:")
    ).length;

    console.log(`   Popular products cache: ${popularKeys} keys`);
    console.log(`   User orders cache: ${userOrderKeys} keys`);
    console.log(`   Product details cache: ${productDetailKeys} keys`);
  } catch (error) {
    console.error("❌ Error getting cache statistics:", error);
  }
}

async function main() {
  const command = process.argv[2] || "full";

  try {
    console.log("🚀 Starting cache test cleanup process...");

    // 데이터베이스 연결
    await dataSource.initialize();
    console.log("📅 Database connected");

    // Redis 연결 확인
    await redis.ping();
    console.log("🔴 Redis connected");

    switch (command) {
      case "full":
        await cleanupCacheTestDatabase();
        await cleanupCacheTestRedisData();
        break;

      case "db":
        await cleanupCacheTestDatabase();
        break;

      case "cache":
        await cleanupCacheTestRedisData();
        break;

      case "flush":
        await flushAllCaches();
        break;

      case "stats":
        await showCacheStatistics();
        break;

      default:
        console.log("❓ Unknown command. Available commands:");
        console.log("  full  - Clean up both database and cache (default)");
        console.log("  db    - Clean up database only");
        console.log("  cache - Clean up Redis cache only");
        console.log("  flush - Flush all Redis caches");
        console.log("  stats - Show current cache statistics");
        process.exit(1);
    }

    console.log("🎉 Cache test cleanup process completed!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    await redis.disconnect();
  }
}

if (require.main === module) {
  main();
}
