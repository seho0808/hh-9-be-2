/**
 * 실제 데이터베이스에서 EXPLAIN 쿼리를 실행하여 성능 분석용 결과를 얻는 스크립트
 * 엔티티 의존성 없이 직접 테이블 생성
 */

import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import { DataSource } from "typeorm";
import { v4 as uuid } from "uuid";

class DirectExplainRunner {
  private mysqlContainer: StartedMySqlContainer | null = null;
  private dataSource: DataSource | null = null;

  async setup() {
    console.log("🚀 MySQL 컨테이너 시작...");

    this.mysqlContainer = await new MySqlContainer("mysql:8.0")
      .withDatabase("test_db")
      .withUsername("test_user")
      .withRootPassword("test_password")
      .withExposedPorts(3306)
      .start();

    console.log(
      `🐳 MySQL Container started on port ${this.mysqlContainer.getPort()}`
    );

    this.dataSource = new DataSource({
      type: "mysql",
      host: this.mysqlContainer.getHost(),
      port: this.mysqlContainer.getPort(),
      username: this.mysqlContainer.getUsername(),
      password: this.mysqlContainer.getUserPassword(),
      database: this.mysqlContainer.getDatabase(),
      entities: [],
      synchronize: false,
      logging: false,
    });

    await this.dataSource.initialize();
    console.log("✅ 데이터베이스 연결 완료");
  }

  async cleanup() {
    console.log("🧹 정리 작업...");

    if (this.dataSource) {
      await this.dataSource.destroy();
      console.log("📦 DataSource 종료");
    }

    if (this.mysqlContainer) {
      await this.mysqlContainer.stop();
      console.log("🐳 MySQL Container 종료");
    }
  }

  async createTables() {
    if (!this.dataSource) throw new Error("DataSource not initialized");

    console.log("🔧 테이블 생성 중...");

    // 테이블 생성 쿼리들
    const createTableQueries = [
      `CREATE TABLE users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`,

      `CREATE TABLE products (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        price INT NOT NULL,
        total_stock INT DEFAULT 0,
        reserved_stock INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_products_name (name),
        INDEX idx_products_is_active (is_active)
      ) ENGINE=InnoDB`,

      `CREATE TABLE orders (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        total_price INT NOT NULL,
        discount_price INT DEFAULT 0,
        final_price INT NOT NULL,
        status ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
        failed_reason TEXT,
        idempotency_key VARCHAR(100) NOT NULL,
        applied_user_coupon_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_orders_user_id (user_id),
        INDEX idx_orders_status (status),
        UNIQUE INDEX idx_orders_idempotency_key (idempotency_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`,

      `CREATE TABLE order_items (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        quantity INT NOT NULL,
        unit_price INT NOT NULL,
        total_price INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_order_items_order_id (order_id),
        INDEX idx_order_items_product_id (product_id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`,

      `CREATE TABLE stock_reservations (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        quantity INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        order_id VARCHAR(36) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`,
    ];

    for (const query of createTableQueries) {
      try {
        await this.dataSource.query(query);
      } catch (error) {
        console.log(`⚠️ 테이블 생성 오류: ${error.message}`);
      }
    }

    console.log("✅ 테이블 생성 완료");
  }

  async createTestData() {
    if (!this.dataSource) throw new Error("DataSource not initialized");

    console.log("📊 테스트 데이터 생성 중...");

    // 사용자 데이터 생성 (1,000명)
    const users = [];
    for (let i = 1; i <= 1000; i++) {
      const userId = uuid();
      users.push([
        userId,
        `user${i}@test.com`,
        "hashedpassword",
        `User ${i}`,
        new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        new Date(),
      ]);
    }

    // 배치 insert를 위한 쿼리
    const userInsertQuery = `
      INSERT INTO users (id, email, password, name, created_at, updated_at) 
      VALUES ?
    `;
    await this.dataSource.query(userInsertQuery, [users]);

    // 상품 데이터 생성 (200개)
    const products = [];
    for (let i = 1; i <= 200; i++) {
      const productId = uuid();
      products.push([
        productId,
        `Product ${i}`,
        `This is a detailed description for Product ${i}. It contains various keywords for testing search functionality.`,
        Math.floor(Math.random() * 100000) + 1000,
        Math.floor(Math.random() * 1000) + 10,
        0,
        Math.random() > 0.1, // 90% 활성
        new Date(Date.now() - Math.random() * 200 * 24 * 60 * 60 * 1000),
        new Date(),
      ]);
    }

    const productInsertQuery = `
      INSERT INTO products (id, name, description, price, total_stock, reserved_stock, is_active, created_at, updated_at) 
      VALUES ?
    `;
    await this.dataSource.query(productInsertQuery, [products]);

    // 주문 데이터 생성 (10,000개)
    const orders = [];
    const orderItems = [];

    for (let i = 1; i <= 10000; i++) {
      const orderId = uuid();
      const userId = users[Math.floor(Math.random() * users.length)][0];
      const status =
        Math.random() < 0.7
          ? "SUCCESS"
          : Math.random() < 0.9
            ? "PENDING"
            : Math.random() < 0.95
              ? "FAILED"
              : "CANCELLED";

      orders.push([
        orderId,
        userId,
        Math.floor(Math.random() * 100000) + 5000,
        0,
        Math.floor(Math.random() * 100000) + 5000,
        status,
        null,
        `key_${i}`,
        null,
        new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
        new Date(),
      ]);

      // 각 주문에 1-3개 아이템 추가
      const itemCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 5) + 1;
        orderItems.push([
          uuid(),
          orderId,
          product[0], // product id
          quantity,
          product[3], // product price
          product[3] * quantity,
          new Date(),
          new Date(),
        ]);
      }
    }

    const orderInsertQuery = `
      INSERT INTO orders (id, user_id, total_price, discount_price, final_price, status, failed_reason, idempotency_key, applied_user_coupon_id, created_at, updated_at) 
      VALUES ?
    `;
    await this.dataSource.query(orderInsertQuery, [orders]);

    const orderItemInsertQuery = `
      INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price, created_at, updated_at) 
      VALUES ?
    `;
    await this.dataSource.query(orderItemInsertQuery, [orderItems]);

    // 재고 예약 데이터 생성 (1,000개)
    const stockReservations = [];
    for (let i = 1; i <= 1000; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const order = orders[Math.floor(Math.random() * orders.length)];

      stockReservations.push([
        uuid(),
        product[0], // product_id
        user[0], // user_id
        Math.floor(Math.random() * 5) + 1,
        Math.random() > 0.3, // 70% 활성
        order[0], // order_id
        new Date(Date.now() + 30 * 60 * 1000), // 30분 후 만료
        new Date(),
        new Date(),
      ]);
    }

    const stockReservationInsertQuery = `
      INSERT INTO stock_reservations (id, product_id, user_id, quantity, is_active, order_id, expires_at, created_at, updated_at) 
      VALUES ?
    `;
    await this.dataSource.query(stockReservationInsertQuery, [
      stockReservations,
    ]);

    console.log("✅ 테스트 데이터 생성 완료");
    console.log(`   - 사용자: ${users.length}명`);
    console.log(`   - 상품: ${products.length}개`);
    console.log(`   - 주문: ${orders.length}개`);
    console.log(`   - 주문아이템: ${orderItems.length}개`);
    console.log(`   - 재고예약: ${stockReservations.length}개`);

    return users[0][0]; // 첫 번째 사용자 ID 반환
  }

  async runExplainQueries(testUserId: string) {
    if (!this.dataSource) throw new Error("DataSource not initialized");

    console.log("\n🔍 EXPLAIN 쿼리 실행 시작...\n");
    console.log(`테스트 사용자 ID: ${testUserId}\n`);

    const queries = [
      {
        name: "사용자별 주문 이력 조회 (인덱스 적용 전)",
        query: `
          SELECT o.*, oi.* 
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.user_id = '${testUserId}'
          ORDER BY o.created_at DESC
        `,
      },
      {
        name: "상품 검색 (LIKE 패턴)",
        query: `
          SELECT * FROM products 
          WHERE is_active = 1 
            AND (name LIKE '%Product 1%' OR description LIKE '%Product 1%')
          LIMIT 20
        `,
      },
      {
        name: "실패한 주문 배치 조회",
        query: `
          SELECT o.*, oi.* 
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.status = 'FAILED'
          ORDER BY o.updated_at ASC
          LIMIT 100
        `,
      },
      {
        name: "오래된 대기 주문 조회",
        query: `
          SELECT o.*, oi.* 
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.status = 'PENDING' 
            AND o.created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
          ORDER BY o.created_at ASC
          LIMIT 100
        `,
      },
    ];

    // 인덱스 적용 전 EXPLAIN 실행
    for (const { name, query } of queries) {
      console.log(`📊 ${name}`);
      console.log("=".repeat(60));

      try {
        const explainResult = await this.dataSource.query(
          `EXPLAIN ${query.replace(/\s+/g, " ").trim()}`
        );

        console.log("```");
        this.printExplainTable(explainResult);
        console.log("```\n");
      } catch (error) {
        console.error(`❌ 쿼리 실행 실패: ${error.message}`);
      }
    }

    // 인덱스 생성
    console.log("🔧 성능 최적화 인덱스 생성 중...\n");

    const indexes = [
      "CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC)",
      "CREATE INDEX idx_orders_status_updated ON orders(status, updated_at ASC)",
      "CREATE INDEX idx_orders_status_created ON orders(status, created_at ASC)",
      "CREATE INDEX idx_stock_reservations_order_id ON stock_reservations(order_id)",
      "CREATE INDEX idx_products_active_name ON products(is_active, name)",
    ];

    for (const indexQuery of indexes) {
      try {
        await this.dataSource.query(indexQuery);
        console.log(`✅ ${indexQuery}`);
      } catch (error) {
        console.log(`⚠️  ${indexQuery} - ${error.message}`);
      }
    }

    // 인덱스 적용 후 EXPLAIN 실행
    console.log("\n🚀 인덱스 적용 후 EXPLAIN 결과:\n");

    const optimizedQueries = [
      {
        name: "사용자별 주문 이력 조회 (인덱스 적용 후)",
        query: `
          SELECT o.*, oi.* 
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.user_id = '${testUserId}'
          ORDER BY o.created_at DESC
        `,
      },
      {
        name: "실패한 주문 배치 조회 (인덱스 적용 후)",
        query: `
          SELECT o.*, oi.* 
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.status = 'FAILED'
          ORDER BY o.updated_at ASC
          LIMIT 100
        `,
      },
    ];

    for (const { name, query } of optimizedQueries) {
      console.log(`📊 ${name}`);
      console.log("=".repeat(60));

      try {
        const explainResult = await this.dataSource.query(
          `EXPLAIN ${query.replace(/\s+/g, " ").trim()}`
        );

        console.log("```");
        this.printExplainTable(explainResult);
        console.log("```\n");
      } catch (error) {
        console.error(`❌ 쿼리 실행 실패: ${error.message}`);
      }
    }

    // 재고 예약 조회 테스트
    const [orderResult] = await this.dataSource.query(
      "SELECT id FROM orders ORDER BY RAND() LIMIT 1"
    );
    const testOrderId = orderResult.id;

    console.log(`📊 재고 예약 조회 (order_id: ${testOrderId})`);
    console.log("=".repeat(60));

    try {
      const explainResult = await this.dataSource.query(
        `EXPLAIN SELECT * FROM stock_reservations WHERE order_id = '${testOrderId}'`
      );

      console.log("```");
      this.printExplainTable(explainResult);
      console.log("```\n");
    } catch (error) {
      console.error(`❌ 쿼리 실행 실패: ${error.message}`);
    }
  }

  private printExplainTable(explainResult: any[]) {
    if (explainResult.length === 0) {
      console.log("No results");
      return;
    }

    // 헤더 출력
    const headers = Object.keys(explainResult[0]);
    const maxLengths = headers.map((header) =>
      Math.max(
        header.length,
        ...explainResult.map((row) => String(row[header] || "").length)
      )
    );

    // 상단 경계선
    const topBorder =
      "+" + maxLengths.map((len) => "-".repeat(len + 2)).join("+") + "+";
    console.log(topBorder);

    // 헤더 행
    const headerRow =
      "|" +
      headers
        .map((header, i) => ` ${header.padEnd(maxLengths[i])} `)
        .join("|") +
      "|";
    console.log(headerRow);

    // 헤더 구분선
    const separatorBorder =
      "+" + maxLengths.map((len) => "-".repeat(len + 2)).join("+") + "+";
    console.log(separatorBorder);

    // 데이터 행들
    explainResult.forEach((row) => {
      const dataRow =
        "|" +
        headers
          .map(
            (header, i) =>
              ` ${String(row[header] || "").padEnd(maxLengths[i])} `
          )
          .join("|") +
        "|";
      console.log(dataRow);
    });

    // 하단 경계선
    console.log(topBorder);
  }
}

async function main() {
  const runner = new DirectExplainRunner();

  try {
    await runner.setup();
    await runner.createTables();
    const testUserId = await runner.createTestData();
    await runner.runExplainQueries(testUserId);
  } catch (error) {
    console.error("❌ 스크립트 실행 중 오류 발생:", error);
  } finally {
    await runner.cleanup();
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}
