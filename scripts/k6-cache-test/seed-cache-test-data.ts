import "reflect-metadata";
import { DataSource } from "typeorm";
import { CouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { UserTypeOrmEntity } from "../../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import {
  OrderStatus,
  OrderTypeOrmEntity,
} from "../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { ProductFactory } from "../../src/product/infrastructure/persistence/factories/product.factory";
import { OrderFactory } from "../../src/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "../../src/order/infrastructure/persistence/factories/order-item.factory";

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

async function cleanupCacheTestData() {
  console.log("🧹 Cleaning up existing cache test data...");

  // 역순으로 정리 (FK 관계 고려)
  await dataSource.query(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%cachetest.example.com' OR email LIKE '%mixeduser%'))"
  );
  await dataSource.query(
    "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%cachetest.example.com' OR email LIKE '%mixeduser%')"
  );
  await dataSource.query(
    "DELETE FROM point_transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%cachetest.example.com' OR email LIKE '%mixeduser%')"
  );
  await dataSource.query(
    "DELETE FROM user_balances WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%cachetest.example.com' OR email LIKE '%mixeduser%')"
  );
  await dataSource.query(
    "DELETE FROM users WHERE email LIKE '%cachetest.example.com' OR email LIKE '%mixeduser%'"
  );
  await dataSource.query(
    "DELETE FROM products WHERE id LIKE 'cache-test-product-%'"
  );

  console.log("✅ Cleanup completed");
}

async function seedProducts() {
  console.log("🌱 Seeding test products...");

  const productRepository = dataSource.getRepository(ProductTypeOrmEntity);
  const products = [];

  // 캐시 테스트용 최소한의 상품만 생성 (반복 테스트용)
  const productData = [
    { name: "Popular Product A", basePrice: 50000 },
    { name: "Popular Product B", basePrice: 75000 },
    { name: "Popular Product C", basePrice: 100000 },
    { name: "Regular Product D", basePrice: 30000 },
    { name: "Regular Product E", basePrice: 45000 },
  ];

  for (let i = 0; i < productData.length; i++) {
    const productInfo = productData[i];
    const product = ProductFactory.create({
      id: `cache-test-product-${i + 1}`,
      name: productInfo.name,
      description: `Cache testing product - ${productInfo.name}`,
      price: productInfo.basePrice,
      totalStock: 1000,
      reservedStock: 0,
      isActive: true,
    });

    products.push(product);
  }

  await productRepository.save(products);
  console.log(
    `✅ Created ${products.length} test products (optimized for cache testing)`
  );
  return products;
}

async function seedUsers() {
  console.log("🌱 Seeding test users...");

  const userRepository = dataSource.getRepository(UserTypeOrmEntity);
  const userBalanceRepository = dataSource.getRepository(
    UserBalanceTypeOrmEntity
  );

  const users = [];
  const userBalances = [];

  // 캐시 테스트용 최소한의 사용자만 생성 (반복 테스트용)
  const bcrypt = require("bcrypt");
  const testPassword = "testpassword123";
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  for (let i = 1; i <= 3; i++) {
    const user = await userRepository.save({
      id: `cache-test-user-${i}`,
      email: `cacheuser${i}@cachetest.example.com`,
      name: `Cache Test User ${i}`,
      password: hashedPassword, // 실제 테스트용 해시된 비밀번호
    });
    users.push(user);

    // 각 사용자에게 포인트 잔액 부여
    const balance = {
      id: `cache-test-balance-${i}`,
      userId: user.id,
      balance: 500000, // 고정 잔액으로 테스트 일관성 확보
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userBalances.push(balance);
  }

  await userRepository.save(users);
  await userBalanceRepository.save(userBalances);

  console.log(
    `✅ Created ${users.length} test users with balances (optimized for cache testing)`
  );
  return users;
}

async function seedOrders(users: any[], products: any[]) {
  console.log("🌱 Seeding test orders for cache data...");

  const orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
  const orderItemRepository = dataSource.getRepository(OrderItemTypeOrmEntity);

  const orders = [];
  const orderItems = [];

  // 최근 7일간의 주문 데이터만 생성 (캐시 테스트에 집중)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 상위 3개 상품을 인기 상품으로 설정
  const popularProducts = products.slice(0, 3);

  // 각 사용자별로 동일한 상품들에 대한 주문 생성 (캐시 효과 극대화)
  for (let i = 1; i <= 15; i++) {
    const user = users[i % users.length]; // 사용자 순환 선택

    const orderDate = new Date(
      sevenDaysAgo.getTime() +
        Math.random() * (now.getTime() - sevenDaysAgo.getTime())
    );

    // 인기 상품 중 하나를 선택 (동일 상품에 대한 반복 주문)
    const product = popularProducts[i % popularProducts.length];
    const quantity = Math.floor(Math.random() * 3) + 1;
    const totalPrice = product.price * quantity;

    const order = OrderFactory.create({
      id: `cache-test-order-${i}`,
      userId: user.id,
      totalPrice: totalPrice,
      status: OrderStatus.SUCCESS,
      createdAt: orderDate,
      updatedAt: orderDate,
    });

    const orderItem = OrderItemFactory.create({
      id: `cache-test-order-item-${i}`,
      orderId: order.id,
      productId: product.id,
      quantity: quantity,
      unitPrice: product.price,
      totalPrice: totalPrice,
      createdAt: orderDate,
      updatedAt: orderDate,
    });

    orders.push(order);
    orderItems.push(orderItem);
  }

  await orderRepository.save(orders);
  await orderItemRepository.save(orderItems);

  console.log(
    `✅ Created ${orders.length} test orders with ${orderItems.length} order items (optimized for cache testing)`
  );
}

async function main() {
  try {
    console.log("🚀 Starting cache test data setup...");

    await dataSource.initialize();
    console.log("📅 Database connected");

    await cleanupCacheTestData();

    const products = await seedProducts();
    const users = await seedUsers();
    await seedOrders(users, products);

    console.log("🎉 Cache test data setup completed successfully!");
    console.log("");
    console.log("📋 Test data summary (optimized for cache testing):");
    console.log(`   - Products: ${products.length} (focused on cache hits)`);
    console.log(`   - Users: ${users.length} (minimal for testing)`);
    console.log(`   - Orders: 15 (concentrated on popular products)`);
    console.log("");
    console.log("📋 Next steps:");
    console.log("  1. Start your NestJS application: npm run start");
    console.log("  2. Run cache performance tests:");
    console.log(
      "     npm run k6:cache:popular-products          # Cache enabled"
    );
    console.log(
      "     npm run k6:cache:popular-products:disabled # Cache disabled"
    );
    console.log(
      "     npm run k6:cache:user-orders               # Cache enabled"
    );
    console.log(
      "     npm run k6:cache:user-orders:disabled      # Cache disabled"
    );
    console.log(
      "     npm run k6:cache:product-details           # Cache enabled"
    );
    console.log(
      "     npm run k6:cache:product-details:disabled  # Cache disabled"
    );
    console.log("  3. Clean up after testing: npm run cleanup:cache-test-data");
  } catch (error) {
    console.error("❌ Error during cache test data setup:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main();
}
