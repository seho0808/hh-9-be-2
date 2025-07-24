import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource } from "typeorm";
import { TestContainersHelper } from "../testcontainers-helper";

describe("User API E2E (with TestContainers)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testHelper: TestContainersHelper; // 인스턴스 추가

  beforeAll(async () => {
    testHelper = new TestContainersHelper(); // 인스턴스 생성
    const setup = await testHelper.setupWithMySQL();
    app = setup.app;
    dataSource = setup.dataSource;
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
  });

  describe("GET /api/users/me", () => {
    it("✅ 유효한 토큰으로 사용자 정보를 조회할 수 있어야 함", async () => {
      // Given: 테스트 사용자 생성
      const testUser = await testHelper.createTestUser(dataSource);

      // When: 실제 로그인으로 토큰 받아서 내 정보 조회
      const authHeaders = await testHelper.getAuthHeaders(app);
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

    it("❌ 토큰 없이 접근하면 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 내 정보 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });

    it("❌ 잘못된 토큰으로 접근하면 401 에러가 발생해야 함", async () => {
      // When: 잘못된 토큰으로 내 정보 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(testHelper.getInvalidAuthHeaders())
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("유효하지 않은 토큰입니다");
    });

    it("❌ Bearer 형식이 아닌 토큰으로 접근하면 401 에러가 발생해야 함", async () => {
      // When: 잘못된 형식의 토큰으로 접근
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set("Authorization", "Basic mock-jwt-token")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });

    it("❌ 유효한 토큰이지만 사용자가 DB에 존재하지 않으면 404 에러가 발생해야 함", async () => {
      // Given: 로그인을 위한 사용자를 먼저 생성한 후 삭제
      await testHelper.createTestUser(dataSource);
      const authHeaders = await testHelper.getAuthHeaders(app);
      await testHelper.clearDatabase(dataSource); // 로그인 후 사용자 삭제

      // When: 유효한 토큰으로 내 정보 조회 (하지만 DB에 사용자 없음)
      const response = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(authHeaders)
        .expect(404);

      // Then: 사용자를 찾을 수 없다는 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("사용자를 찾을 수 없습니다");
    });

    it("🔄 여러 사용자 데이터로 테스트", async () => {
      // Given: 기본 테스트 사용자 생성 (test@example.com)
      await testHelper.createTestUser(dataSource, {
        id: "user-123",
        email: "test@example.com", // 로그인용 이메일
        name: "테스트 사용자",
      });

      await testHelper.createTestUser(dataSource, {
        id: "user-456",
        email: "user2@example.com",
        name: "사용자2",
      });

      // When: 첫 번째 사용자로 실제 로그인해서 토큰 받기
      const authHeaders = await testHelper.getAuthHeaders(app);
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
    it("🔧 DB 연결 상태 및 테이블 구조 확인", async () => {
      // DB 연결 확인
      const isConnected = await testHelper.verifyDatabaseConnection(dataSource);
      expect(isConnected).toBe(true);

      // 테이블 존재 확인
      const result = await dataSource.query("SHOW TABLES");
      const tableNames = result.map((row: any) => Object.values(row)[0]);
      expect(tableNames).toContain("users");

      // 사용자 테이블 구조 확인
      const columns = await testHelper.getTableInfo(dataSource, "users");
      const columnNames = columns.map((col: any) => col.Field);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("password");
      expect(columnNames).toContain("name");
    });

    it("📊 사용자 생성 후 조회가 제대로 동작해야 함", async () => {
      // Given: 헬퍼를 사용해 테스트 사용자 생성
      const userData = await testHelper.createTestUser(dataSource, {
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

    it("🔍 이메일 고유성 제약조건 테스트", async () => {
      // Given: 첫 번째 사용자 생성
      await testHelper.createTestUser(dataSource, {
        id: "user-001",
        email: "duplicate@test.com",
        name: "사용자1",
      });

      // When & Then: 같은 이메일로 두 번째 사용자 생성 시 에러 발생
      await expect(
        testHelper.createTestUser(dataSource, {
          id: "user-002",
          email: "duplicate@test.com", // 중복 이메일
          name: "사용자2",
        })
      ).rejects.toThrow();
    });
  });
});
