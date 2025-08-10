import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { AppModule } from "../src/app.module";
import { UserTypeOrmEntity } from "../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { ProductTypeOrmEntity } from "../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "../src/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { CouponTypeOrmEntity } from "../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { OrderTypeOrmEntity } from "../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { DataSource } from "typeorm";
import * as request from "supertest";
import { PointTransactionTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import {
  initializeTransactionalContext,
  addTransactionalDataSource,
} from "typeorm-transactional";
import * as bcrypt from "bcrypt";

export interface TestContainerConfig {
  mysqlVersion?: string;
  database?: string;
  username?: string;
  password?: string;
  redisVersion?: string;
}

export class TestContainersHelper {
  private mysqlContainer: StartedMySqlContainer | null = null;
  private redisContainer: StartedRedisContainer | null = null;
  private app: INestApplication | null = null;
  private dataSource: DataSource | null = null;

  private async setupMySQLContainer(config: TestContainerConfig = {}): Promise<{
    container: StartedMySqlContainer;
    workerId: string;
  }> {
    const workerId = process.env.JEST_WORKER_ID || "1";
    const timestamp = Date.now();

    const {
      mysqlVersion = "mysql:8.0",
      database = `test_db_worker_${workerId}_${timestamp}`,
      username = "test_user",
      password = "test_password",
    } = config;

    console.log(`🚀 [Worker ${workerId}] Starting MySQL setup...`);

    this.mysqlContainer = await new MySqlContainer(mysqlVersion)
      .withDatabase(database)
      .withUsername(username)
      .withRootPassword(password)
      .withExposedPorts(3306)
      .start();

    console.log(
      `🐳 [Worker ${workerId}] MySQL Container started on port ${this.mysqlContainer.getPort()}`
    );

    return {
      container: this.mysqlContainer,
      workerId,
    };
  }

  private async setupRedisContainer(config: TestContainerConfig = {}): Promise<{
    container: StartedRedisContainer;
    workerId: string;
  }> {
    const workerId = process.env.JEST_WORKER_ID || "1";
    const { redisVersion = "redis:7-alpine" } = config;

    console.log(`🚀 [Worker ${workerId}] Starting Redis setup...`);

    this.redisContainer = await new RedisContainer(redisVersion)
      .withExposedPorts(6379)
      .start();

    console.log(
      `🔴 [Worker ${workerId}] Redis Container started on port ${this.redisContainer.getPort()}`
    );

    return {
      container: this.redisContainer,
      workerId,
    };
  }

  private async createDataSource(
    container: StartedMySqlContainer
  ): Promise<DataSource> {
    const dataSource = new DataSource({
      type: "mysql",
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getUserPassword(),
      database: container.getDatabase(),
      entities: [
        UserTypeOrmEntity,
        ProductTypeOrmEntity,
        StockReservationTypeOrmEntity,
        CouponTypeOrmEntity,
        UserCouponTypeOrmEntity,
        UserBalanceTypeOrmEntity,
        PointTransactionTypeOrmEntity,
        OrderTypeOrmEntity,
        OrderItemTypeOrmEntity,
      ],
      synchronize: true,
      dropSchema: true,
      logging: false,
    });

    await dataSource.initialize();
    addTransactionalDataSource(dataSource);

    return dataSource;
  }

  async setupDatabaseAndRedis(config: TestContainerConfig = {}): Promise<{
    dataSource: DataSource;
    mysqlContainer: StartedMySqlContainer;
    redisContainer: StartedRedisContainer;
  }> {
    initializeTransactionalContext();

    const { container: mysqlContainer, workerId } =
      await this.setupMySQLContainer(config);
    const { container: redisContainer } =
      await this.setupRedisContainer(config);

    // Create minimal DataSource for integration tests
    this.dataSource = await this.createDataSource(mysqlContainer);

    console.log(`✅ [Worker ${workerId}] Database and Redis initialized`);

    return {
      dataSource: this.dataSource,
      mysqlContainer,
      redisContainer,
    };
  }

  async setupWithMySQL(config: TestContainerConfig = {}): Promise<{
    app: INestApplication;
    dataSource: DataSource;
    container: StartedMySqlContainer;
  }> {
    initializeTransactionalContext();

    const { container, workerId } = await this.setupMySQLContainer(config);

    // 테스트 모듈 생성
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "mysql",
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getUserPassword(),
          database: container.getDatabase(),
          entities: [
            UserTypeOrmEntity,
            ProductTypeOrmEntity,
            StockReservationTypeOrmEntity,
            CouponTypeOrmEntity,
            UserCouponTypeOrmEntity,
            UserBalanceTypeOrmEntity,
            PointTransactionTypeOrmEntity,
            OrderTypeOrmEntity,
            OrderItemTypeOrmEntity,
          ],
          synchronize: true,
          dropSchema: true,
          logging: false, // 테스트 시 로깅 비활성화
        }),
        AppModule,
      ],
    })
      .overrideProvider("DatabaseModule")
      .useValue({})
      .compile();

    // NestJS 앱 생성 및 초기화
    this.app = moduleFixture.createNestApplication();
    this.app.setGlobalPrefix("api");

    // GlobalExceptionFilter 설정 (main.ts와 동일)
    this.app.useGlobalFilters(
      new (
        await import(
          "../src/common/presentation/filters/global-exception.filter"
        )
      ).GlobalExceptionFilter()
    );

    // ValidationPipe 설정 (main.ts와 동일)
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );

    await this.app.init();

    this.dataSource = this.app.get(DataSource);
    addTransactionalDataSource(this.dataSource);

    console.log(`✅ [Worker ${workerId}] NestJS Application initialized`);

    return {
      app: this.app,
      dataSource: this.dataSource,
      container,
    };
  }

  async setupDatabaseOnly(config: TestContainerConfig = {}): Promise<{
    dataSource: DataSource;
    container: StartedMySqlContainer;
  }> {
    initializeTransactionalContext();

    const { container, workerId } = await this.setupMySQLContainer(config);

    // Create minimal DataSource for integration tests
    this.dataSource = await this.createDataSource(container);

    console.log(`✅ [Worker ${workerId}] Database initialized`);

    return {
      dataSource: this.dataSource,
      container,
    };
  }

  async cleanup(): Promise<void> {
    const workerId = process.env.JEST_WORKER_ID || "1";
    console.log(`🧹 [Worker ${workerId}] Cleaning up TestContainers...`);

    try {
      if (this.dataSource) {
        await this.dataSource.destroy();
        this.dataSource = null;
        console.log(`📦 [Worker ${workerId}] DataSource destroyed`);
      }

      if (this.app) {
        await this.app.close();
        this.app = null;
        console.log(`🛑 [Worker ${workerId}] NestJS Application closed`);
      }

      if (this.mysqlContainer) {
        await this.mysqlContainer.stop();
        this.mysqlContainer = null;
        console.log(`🐳 [Worker ${workerId}] MySQL Container stopped`);
      }

      if (this.redisContainer) {
        await this.redisContainer.stop();
        this.redisContainer = null;
        console.log(`🔴 [Worker ${workerId}] Redis Container stopped`);
      }
    } catch (error) {
      console.error(`❌ [Worker ${workerId}] Cleanup error:`, error);
    }
  }

  async clearDatabase(dataSource: DataSource): Promise<void> {
    const tables = [
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

    try {
      await dataSource.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const table of tables) {
        try {
          await dataSource.query(`DELETE FROM ${table}`);
        } catch (error) {
          console.warn(`Failed to truncate table ${table}:`, error.message);
        }
      }
      await dataSource.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (error) {
      console.warn("Database cleanup error:", error);
    }
  }

  async createTestUser(
    dataSource: DataSource,
    userData: {
      id?: string;
      email?: string;
      password?: string;
      name?: string;
    } = {}
  ): Promise<any> {
    const hashedPassword = bcrypt.hashSync("testPassword123", 10);

    const defaultUser = {
      id: "user-123",
      email: "test@example.com",
      password: hashedPassword,
      name: "테스트 사용자",
      created_at: new Date(),
      updated_at: new Date(),
      ...userData,
    };

    await dataSource
      .createQueryBuilder()
      .insert()
      .into("users")
      .values(defaultUser)
      .execute();

    return defaultUser;
  }

  async getAuthHeaders(app: INestApplication): Promise<Record<string, string>> {
    // 실제 로그인을 통해 JWT 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "testPassword123",
      })
      .expect(200);

    const loginData = loginResponse.body;

    if (!loginData.success || !loginData.data.accessToken) {
      throw new Error("Login failed for test user");
    }

    return {
      Authorization: `Bearer ${loginData.data.accessToken}`,
    };
  }

  getMockAuthHeaders(): Record<string, string> {
    return {
      Authorization: "Bearer mock-jwt-token",
    };
  }

  getInvalidAuthHeaders(): Record<string, string> {
    return {
      Authorization: "Bearer invalid-token",
    };
  }

  async verifyDatabaseConnection(dataSource: DataSource): Promise<boolean> {
    try {
      await dataSource.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database connection failed:", error);
      return false;
    }
  }

  async getTableInfo(
    dataSource: DataSource,
    tableName: string
  ): Promise<any[]> {
    return await dataSource.query(`DESCRIBE ${tableName}`);
  }
}
