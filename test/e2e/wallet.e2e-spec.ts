import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource, Repository } from "typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../test-environment/test-environment.factory";
import { UserBalanceFactory } from "../../src/wallet/infrastructure/persistence/factories/user-balance.factory";
import { PointTransactionFactory } from "../../src/wallet/infrastructure/persistence/factories/point-transaction.factory";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";

describe("Wallet API E2E (with TestContainers)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>;
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createE2EEnvironment();
    app = environment.app!;
    dataSource = environment.dataSource;
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
    pointTransactionRepository = dataSource.getRepository(
      PointTransactionTypeOrmEntity
    );
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    // 각 테스트를 위한 기본 사용자 생성 (인증용)
    await environment.dataHelper.createTestUser();
  });

  describe("GET /api/users/me/points/balance", () => {
    it("내 잔액을 조회할 때 올바른 잔액 정보가 반환되어야 함", async () => {
      // Given: 테스트 사용자의 잔액 생성
      const testBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123", // TestContainersHelper에서 생성되는 사용자 ID
          balance: 50000,
        }
      );
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 잔액 조회
      const response = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      // Then: 잔액 정보가 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        balance: testBalance.balance,
        userId: testBalance.userId,
      });
      expect(response.body.message).toBe("잔액을 성공적으로 조회했습니다");
    });

    it("지갑이 없는 경우 잔액을 조회할 때 0원으로 반환되어야 함", async () => {
      // Given: 지갑이 없는 사용자
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 잔액 조회
      const response = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      // Then: 0원으로 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(0);
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 잔액 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("POST /api/users/me/points/charges", () => {
    it("유효한 금액으로 포인트를 충전할 때 충전이 성공적으로 이루어져야 함", async () => {
      // Given: 테스트 사용자의 잔액 생성
      const testBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 10000,
        }
      );
      const authHeaders = await environment.dataHelper.getAuthHeaders();
      const chargeAmount = 50000;

      // When: 포인트 충전
      const response = await request(app.getHttpServer())
        .post("/api/users/me/points/charges")
        .set(authHeaders)
        .send({ amount: chargeAmount })
        .expect(201);

      // Then: 충전이 성공적으로 이루어져야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        amount: chargeAmount,
        chargedAt: expect.any(String),
        newBalance: testBalance.balance + chargeAmount,
        transactionId: expect.any(String),
      });
      expect(response.body.message).toBe("포인트 충전이 완료되었습니다");

      // 트랜잭션이 기록되었는지 확인
      const transactions = await pointTransactionRepository.find();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(chargeAmount);
      expect(transactions[0].type).toBe("CHARGE");
    });

    it("잘못된 충전 금액으로 요청할 때 400 에러가 발생해야 함", async () => {
      // Given: 인증 헤더 준비
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 잘못된 금액으로 충전 시도
      const response = await request(app.getHttpServer())
        .post("/api/users/me/points/charges")
        .set(authHeaders)
        .send({ amount: -1000 })
        .expect(400);

      // Then: 잘못된 금액 에러 메시지가 반환되어야 함
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("최소 충전 금액은 1,000원입니다");
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 충전 시도
      const response = await request(app.getHttpServer())
        .post("/api/users/me/points/charges")
        .send({ amount: 10000 })
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });
});
