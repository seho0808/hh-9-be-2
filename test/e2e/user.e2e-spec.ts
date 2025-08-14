import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource } from "typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../test-environment/test-environment.factory";

describe("User API E2E (with TestContainers)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createE2EEnvironment();
    app = environment.app!;
    dataSource = environment.dataSource;
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
  });

  describe("GET /api/users/me", () => {
    it("유효한 토큰으로 사용자 정보를 조회할 때 올바른 정보가 반환되어야 함", async () => {
      // Given: 테스트 사용자 생성
      const testUser = await environment.dataHelper.createTestUser();

      // When: 실제 로그인으로 토큰 받아서 내 정보 조회
      const authHeaders = await environment.dataHelper.getAuthHeaders();
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(authHeaders)
        .expect(200);

      // Then: 사용자 정보가 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      });
      expect(response.body.data.password).toBeUndefined(); // 비밀번호는 노출되지 않아야 함
      expect(response.body.message).toBe("사용자 정보 조회에 성공했습니다");
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 내 정보 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });

    it("잘못된 토큰으로 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 잘못된 토큰으로 내 정보 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(environment.dataHelper.getInvalidAuthHeaders())
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("유효하지 않은 토큰입니다");
    });

    it("Bearer 형식이 아닌 토큰으로 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 잘못된 형식의 토큰으로 접근
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set("Authorization", "Basic mock-jwt-token")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });

    it("유효한 토큰이지만 사용자가 DB에 존재하지 않을 때 404 에러가 발생해야 함", async () => {
      // Given: 로그인을 위한 사용자를 먼저 생성한 후 삭제
      await environment.dataHelper.createTestUser();
      const authHeaders = await environment.dataHelper.getAuthHeaders();
      await environment.dbHelper.clearDatabase(); // 로그인 후 사용자 삭제

      // When: 유효한 토큰으로 내 정보 조회 (하지만 DB에 사용자 없음)
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(authHeaders)
        .expect(404);

      // Then: 사용자를 찾을 수 없다는 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("사용자를 찾을 수 없습니다");
    });

    it("여러 사용자 데이터로 테스트할 때 올바른 사용자 정보가 반환되어야 함", async () => {
      // Given: 기본 테스트 사용자 생성 (test@example.com)
      await environment.dataHelper.createTestUser({
        id: "user-123",
        email: "test@example.com", // 로그인용 이메일
        name: "테스트 사용자",
      });

      await environment.dataHelper.createTestUser({
        id: "user-456",
        email: "user2@example.com",
        name: "사용자2",
      });

      // When: 첫 번째 사용자로 실제 로그인해서 토큰 받기
      const authHeaders = await environment.dataHelper.getAuthHeaders();
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(authHeaders)
        .expect(200);

      // Then: 올바른 사용자 정보가 반환되어야 함
      expect(response.body.data.id).toBe("user-123");
      expect(response.body.data.email).toBe("test@example.com");
      expect(response.body.data.name).toBe("테스트 사용자");
    });
  });

  describe("Database Integration", () => {
    it("DB 연결 상태 및 테이블 구조를 확인할 때 정상 동작해야 함", async () => {
      // DB 연결 확인
      const isConnected = await environment.dbHelper.verifyConnection();
      expect(isConnected).toBe(true);

      // 테이블 존재 확인
      const result = await dataSource.query("SHOW TABLES");
      const tableNames = result.map((row: any) => Object.values(row)[0]);
      expect(tableNames).toContain("users");

      // 사용자 테이블 구조 확인
      const columns = await environment.dbHelper.getTableInfo("users");
      const columnNames = columns.map((col: any) => col.Field);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("password");
      expect(columnNames).toContain("name");
    });

    it("사용자 생성 후 조회할 때 제대로 동작해야 함", async () => {
      // Given: 헬퍼를 사용해 테스트 사용자 생성
      const userData = await environment.dataHelper.createTestUser({
        id: "test-user-789",
        email: "integration@test.com",
        name: "통합테스트사용자",
      });

      // When: DB에서 직접 조회
      const dbResult = await dataSource.query(
        "SELECT * FROM users WHERE id = ?",
        [userData.id]
      );

      // Then: 데이터가 올바르게 저장되고 조회되어야 함
      expect(dbResult).toHaveLength(1);
      expect(dbResult[0].email).toBe(userData.email);
      expect(dbResult[0].name).toBe(userData.name);
    });

    it("이메일 고유성 제약조건을 테스트할 때 중복 시 에러가 발생해야 함", async () => {
      // Given: 첫 번째 사용자 생성
      await environment.dataHelper.createTestUser({
        id: "user-001",
        email: "duplicate@test.com",
        name: "사용자1",
      });

      // When & Then: 같은 이메일로 두 번째 사용자 생성 시 에러 발생
      await expect(
        environment.dataHelper.createTestUser({
          id: "user-002",
          email: "duplicate@test.com", // 중복 이메일
          name: "사용자2",
        })
      ).rejects.toThrow();
    });
  });
});
