import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import { AppModule } from "../../src/app.module";
import { UserTypeOrmEntity } from "../../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { DataSource } from "typeorm";
import * as request from "supertest";

export interface TestContainerConfig {
  mysqlVersion?: string;
  database?: string;
  username?: string;
  password?: string;
}

export class TestContainersHelper {
  private static mysqlContainer: StartedMySqlContainer;
  private static app: INestApplication;
  private static dataSource: DataSource;

  static async setupWithMySQL(config: TestContainerConfig = {}): Promise<{
    app: INestApplication;
    dataSource: DataSource;
    container: StartedMySqlContainer;
  }> {
    // 워커별 고유 설정
    const workerId = process.env.JEST_WORKER_ID || "1";

    const {
      mysqlVersion = "mysql:8.0",
      database = `test_db_worker_${workerId}`, // 워커별 고유 DB명
      username = "test_user",
      password = "test_password",
    } = config;

    // MySQL 컨테이너 시작 (동적 포트 할당)
    this.mysqlContainer = await new MySqlContainer(mysqlVersion)
      .withDatabase(database)
      .withUsername(username)
      .withRootPassword(password)
      .withExposedPorts(3306) // 동적 포트 할당
      .start();

    console.log(
      `🐳 MySQL Container started on port ${this.mysqlContainer.getPort()} (Worker ${workerId})`
    );

    // 테스트 모듈 생성
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "mysql",
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getPort(),
          username: this.mysqlContainer.getUsername(),
          password: this.mysqlContainer.getUserPassword(),
          database: this.mysqlContainer.getDatabase(),
          entities: [UserTypeOrmEntity, ProductTypeOrmEntity],
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

    await this.app.init();

    this.dataSource = this.app.get(DataSource);

    console.log("🚀 NestJS Application initialized with TestContainers");

    return {
      app: this.app,
      dataSource: this.dataSource,
      container: this.mysqlContainer,
    };
  }

  static async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up TestContainers...");

    if (this.dataSource) {
      await this.dataSource.destroy();
      console.log("📦 DataSource destroyed");
    }

    if (this.app) {
      await this.app.close();
      console.log("🛑 NestJS Application closed");
    }

    if (this.mysqlContainer) {
      await this.mysqlContainer.stop();
      console.log("🐳 MySQL Container stopped");
    }
  }

  static async clearDatabase(dataSource: DataSource): Promise<void> {
    // 테스트 간 데이터 정리
    const tables = ["users", "products"]; // 필요에 따라 테이블 추가

    for (const table of tables) {
      try {
        await dataSource.query(`DELETE FROM ${table}`);
      } catch (error) {
        // 테이블이 존재하지 않을 수 있으므로 에러 무시
        console.warn(`Failed to clear table ${table}:`, error);
      }
    }
  }

  static async createTestUser(
    dataSource: DataSource,
    userData: {
      id?: string;
      email?: string;
      password?: string;
      name?: string;
    } = {}
  ): Promise<any> {
    const bcrypt = require("bcrypt");
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

  static async getAuthHeaders(
    app: INestApplication
  ): Promise<Record<string, string>> {
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

  static getMockAuthHeaders(): Record<string, string> {
    return {
      Authorization: "Bearer mock-jwt-token",
    };
  }

  static getInvalidAuthHeaders(): Record<string, string> {
    return {
      Authorization: "Bearer invalid-token",
    };
  }

  static async verifyDatabaseConnection(
    dataSource: DataSource
  ): Promise<boolean> {
    try {
      await dataSource.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database connection failed:", error);
      return false;
    }
  }

  static async getTableInfo(
    dataSource: DataSource,
    tableName: string
  ): Promise<any[]> {
    return await dataSource.query(`DESCRIBE ${tableName}`);
  }
}
