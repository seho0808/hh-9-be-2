import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource, Repository } from "typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../test-environment/test-environment.factory";
import { CouponFactory } from "../../src/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "../../src/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { CouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";

describe("Coupon API E2E (with TestContainers)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createE2EEnvironment();
    app = environment.app!;
    dataSource = environment.dataSource;
    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    // 각 테스트를 위한 기본 사용자 생성 (인증용)
    await environment.dataHelper.createTestUser();
    // Factory counter 초기화
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();
  });

  describe("GET /api/coupons", () => {
    it("전체 쿠폰 목록을 조회할 때 올바른 목록이 반환되어야 함", async () => {
      // Given: 테스트 쿠폰들 생성
      await CouponFactory.createManyAndSave(couponRepository, 3);
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 전체 쿠폰 조회
      const response = await request(app.getHttpServer())
        .get("/api/coupons")
        .set(authHeaders)
        .expect(200);

      // Then: 쿠폰 목록이 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.message).toBe("쿠폰 목록을 조회했습니다");

      // 각 쿠폰이 올바른 구조를 가져야 함
      response.body.data.forEach((coupon: any) => {
        expect(coupon).toHaveProperty("id");
        expect(coupon).toHaveProperty("name");
        expect(coupon).toHaveProperty("type");
        expect(coupon).toHaveProperty("discountValue");
        expect(coupon).toHaveProperty("minOrderAmount");
        expect(coupon).toHaveProperty("totalQuantity");
        expect(coupon).toHaveProperty("usedQuantity");
        expect(coupon).toHaveProperty("remainingQuantity");
        expect(coupon).toHaveProperty("validFrom");
        expect(coupon).toHaveProperty("validTo");
      });
    });

    it("빈 쿠폰 목록을 조회할 때 빈 배열이 반환되어야 함", async () => {
      // Given: 쿠폰 없음
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 전체 쿠폰 조회
      const response = await request(app.getHttpServer())
        .get("/api/coupons")
        .set(authHeaders)
        .expect(200);

      // Then: 빈 배열이 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 쿠폰 목록 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/coupons")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });

    it("잘못된 토큰으로 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 잘못된 토큰으로 쿠폰 목록 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/coupons")
        .set(environment.dataHelper.getInvalidAuthHeaders())
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("유효하지 않은 토큰입니다");
    });
  });

  describe("GET /api/coupons/:couponId", () => {
    it("특정 쿠폰을 조회할 때 올바른 쿠폰 정보가 반환되어야 함", async () => {
      // Given: 테스트 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository, {
        id: "test-coupon-detail",
        name: "상세 조회 테스트 쿠폰",
        description: "상세 조회용 테스트 쿠폰입니다",
        couponCode: "DETAIL2024",
        discountType: "FIXED",
        discountValue: 10000,
        minimumOrderPrice: 50000,
        totalCount: 100,
      });
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 특정 쿠폰 조회
      const response = await request(app.getHttpServer())
        .get(`/api/coupons/${testCoupon.id}`)
        .set(authHeaders)
        .expect(200);

      // Then: 쿠폰 정보가 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testCoupon.id,
        name: testCoupon.name,
        type: "FIXED_AMOUNT",
        discountValue: testCoupon.discountValue,
        minOrderAmount: testCoupon.minimumOrderPrice,
        totalQuantity: testCoupon.totalCount,
        usedQuantity: testCoupon.usedCount,
        remainingQuantity: testCoupon.totalCount - testCoupon.usedCount,
      });
      expect(response.body.message).toBe("쿠폰 정보를 조회했습니다");
    });

    it("퍼센트 할인 쿠폰을 조회할 때 올바른 할인 정보가 반환되어야 함", async () => {
      // Given: 퍼센트 할인 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository, {
        id: "percent-coupon",
        name: "20% 할인 쿠폰",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxDiscountPrice: 30000,
        minimumOrderPrice: 100000,
      });
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 퍼센트 쿠폰 조회
      const response = await request(app.getHttpServer())
        .get(`/api/coupons/${testCoupon.id}`)
        .set(authHeaders)
        .expect(200);

      // Then: 퍼센트 할인 정보가 올바르게 반환되어야 함
      expect(response.body.data.type).toBe("PERCENTAGE");
      expect(response.body.data.discountValue).toBe(20);
      expect(response.body.data.maxDiscount).toBe(30000);
    });

    it("존재하지 않는 쿠폰을 조회할 때 404 에러가 발생해야 함", async () => {
      // Given: 인증 헤더 준비
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 존재하지 않는 쿠폰 조회
      const response = await request(app.getHttpServer())
        .get("/api/coupons/non-existent-coupon")
        .set(authHeaders)
        .expect(404);

      // Then: 쿠폰을 찾을 수 없다는 에러 메시지가 반환되어야 함
      expect(response.body.message).toContain("쿠폰을 찾을 수 없습니다");
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // Given: 테스트 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository);

      // When: 토큰 없이 쿠폰 조회 시도
      const response = await request(app.getHttpServer())
        .get(`/api/coupons/${testCoupon.id}`)
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("POST /api/coupons/:couponId/claims", () => {
    it("유효한 쿠폰 코드로 쿠폰을 발급받을 때 성공적으로 발급되어야 함", async () => {
      // Given: 발급 가능한 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository, {
        id: "claimable-coupon",
        name: "발급 테스트 쿠폰",
        couponCode: "CLAIM2024",
        discountType: "FIXED",
        discountValue: 5000,
        minimumOrderPrice: 30000,
        totalCount: 10,
        issuedCount: 0,
      });
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 쿠폰 발급 요청
      const response = await request(app.getHttpServer())
        .post(`/api/coupons/${testCoupon.id}/claims`)
        .set(authHeaders)
        .send({ couponCode: "CLAIM2024" })
        .expect(201);

      // Then: 쿠폰이 성공적으로 발급되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.userId).toBeDefined();
      expect(response.body.data.status).toBe("ACTIVE");
      expect(response.body.data.canUse).toBe(true);
      expect(response.body.message).toBe("쿠폰이 성공적으로 발급되었습니다");

      // DB에서 사용자 쿠폰이 생성되었는지 확인
      const userCoupons = await userCouponRepository.find();
      expect(userCoupons).toHaveLength(1);
    });

    it("잘못된 쿠폰 코드로 발급할 때 에러가 발생해야 함", async () => {
      // Given: 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "CORRECT2024",
      });
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 잘못된 쿠폰 코드로 발급 시도
      const response = await request(app.getHttpServer())
        .post(`/api/coupons/${testCoupon.id}/claims`)
        .set(authHeaders)
        .send({ couponCode: "WRONG2024" })
        .expect(400);

      // Then: 유효하지 않은 쿠폰 코드 에러가 반환되어야 함
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("유효하지 않은 쿠폰 코드입니다");
    });

    it("재고가 소진된 쿠폰을 발급할 때 에러가 발생해야 함", async () => {
      // Given: 재고가 소진된 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SOLD2024",
        totalCount: 1,
        issuedCount: 1, // 이미 모든 재고 발급됨
      });
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 소진된 쿠폰 발급 시도
      const response = await request(app.getHttpServer())
        .post(`/api/coupons/${testCoupon.id}/claims`)
        .set(authHeaders)
        .send({ couponCode: "SOLD2024" })
        .expect(400);

      // Then: 쿠폰 재고 소진 에러가 반환되어야 함
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain(
        "쿠폰 재고가 모두 소진되었습니다"
      );
    });

    it("만료된 쿠폰을 발급할 때 에러가 발생해야 함", async () => {
      // Given: 만료된 쿠폰 생성
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const testCoupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "EXPIRED2024",
        endDate: pastDate,
      });
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 만료된 쿠폰 발급 시도
      const response = await request(app.getHttpServer())
        .post(`/api/coupons/${testCoupon.id}/claims`)
        .set(authHeaders)
        .send({ couponCode: "EXPIRED2024" })
        .expect(400);

      // Then: 쿠폰 만료 에러가 반환되어야 함
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("만료된 쿠폰입니다");
    });

    it("존재하지 않는 쿠폰으로 발급할 때 404 에러가 발생해야 함", async () => {
      // Given: 인증 헤더 준비
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 존재하지 않는 쿠폰으로 발급 시도
      const response = await request(app.getHttpServer())
        .post("/api/coupons/non-existent/claims")
        .set(authHeaders)
        .send({ couponCode: "ANY2024" })
        .expect(404);

      // Then: 쿠폰을 찾을 수 없다는 에러가 반환되어야 함
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("쿠폰을 찾을 수 없습니다");
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // Given: 테스트 쿠폰 생성
      const testCoupon = await CouponFactory.createAndSave(couponRepository);

      // When: 토큰 없이 쿠폰 발급 시도
      const response = await request(app.getHttpServer())
        .post(`/api/coupons/${testCoupon.id}/claims`)
        .send({ couponCode: "TEST2024" })
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("GET /api/users/me/coupons", () => {
    it("내가 가진 쿠폰 목록을 조회할 때 올바른 목록이 반환되어야 함", async () => {
      // Given: 사용자의 쿠폰들 생성
      const authHeaders = await environment.dataHelper.getAuthHeaders();
      const userId = "user-123"; // TestContainersHelper에서 생성되는 사용자 ID

      const coupon = await CouponFactory.createAndSave(couponRepository, {
        id: "coupon-123",
        name: "테스트 쿠폰",
        couponCode: "TEST2024",
        discountType: "FIXED",
        discountValue: 10000,
      });

      await UserCouponFactory.createManyAndSave(userCouponRepository, 3, {
        userId: userId,
        couponId: coupon.id,
      });

      // When: 내 쿠폰 목록 조회
      const response = await request(app.getHttpServer())
        .get("/api/users/me/coupons")
        .set(authHeaders)
        .expect(200);

      // Then: 내 쿠폰 목록이 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.message).toBe("보유 쿠폰 목록을 조회했습니다");

      // 각 사용자 쿠폰이 올바른 구조를 가져야 함
      response.body.data.forEach((userCoupon: any) => {
        expect(userCoupon).toHaveProperty("id");
        expect(userCoupon).toHaveProperty("userId");
        expect(userCoupon).toHaveProperty("status");
        expect(userCoupon).toHaveProperty("issuedAt");
        expect(userCoupon).toHaveProperty("canUse");
        expect(userCoupon.userId).toBe(userId);
      });
    });

    it("쿠폰이 없는 경우 조회할 때 빈 배열이 반환되어야 함", async () => {
      // Given: 쿠폰이 없는 사용자
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 내 쿠폰 목록 조회
      const response = await request(app.getHttpServer())
        .get("/api/users/me/coupons")
        .set(authHeaders)
        .expect(200);

      // Then: 빈 배열이 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 내 쿠폰 목록 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me/coupons")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("Database Integration", () => {
    it("쿠폰 생성 후 조회할 때 제대로 동작해야 함", async () => {
      // Given: 헬퍼를 사용해 테스트 쿠폰 생성
      const couponData = await CouponFactory.createAndSave(couponRepository, {
        id: "integration-test-coupon",
        name: "통합테스트 쿠폰",
        description: "통합테스트용 쿠폰입니다",
        couponCode: "INTEGRATION2024",
        discountType: "FIXED",
        discountValue: 15000,
        minimumOrderPrice: 80000,
        totalCount: 50,
      });

      // When: DB에서 직접 조회
      const dbResult = await couponRepository.findOne({
        where: { id: couponData.id },
      });

      // Then: 데이터가 올바르게 저장되고 조회되어야 함
      expect(dbResult).toBeDefined();
      expect(dbResult!.name).toBe(couponData.name);
      expect(dbResult!.couponCode).toBe(couponData.couponCode);
      expect(dbResult!.discountValue).toBe(couponData.discountValue);
      expect(dbResult!.totalCount).toBe(couponData.totalCount);
    });

    it("DB 연결 상태 및 테이블 구조를 확인할 때 정상 동작해야 함", async () => {
      // DB 연결 확인
      const isConnected = await environment.dbHelper.verifyConnection();
      expect(isConnected).toBe(true);

      // 테이블 존재 확인
      const result = await dataSource.query("SHOW TABLES");
      const tableNames = result.map((row: any) => Object.values(row)[0]);
      expect(tableNames).toContain("coupons");
      expect(tableNames).toContain("user_coupons");

      // 쿠폰 테이블 구조 확인
      const couponColumns = await environment.dbHelper.getTableInfo("coupons");
      const couponColumnNames = couponColumns.map((col: any) => col.Field);

      expect(couponColumnNames).toContain("id");
      expect(couponColumnNames).toContain("name");
      expect(couponColumnNames).toContain("description");
      expect(couponColumnNames).toContain("coupon_code");
      expect(couponColumnNames).toContain("discount_type");
      expect(couponColumnNames).toContain("discount_value");
      expect(couponColumnNames).toContain("minimum_order_price");
      expect(couponColumnNames).toContain("total_count");

      // 사용자 쿠폰 테이블 구조 확인
      const userCouponColumns =
        await environment.dbHelper.getTableInfo("user_coupons");
      const userCouponColumnNames = userCouponColumns.map(
        (col: any) => col.Field
      );

      expect(userCouponColumnNames).toContain("id");
      expect(userCouponColumnNames).toContain("coupon_id");
      expect(userCouponColumnNames).toContain("user_id");
      expect(userCouponColumnNames).toContain("status");
      expect(userCouponColumnNames).toContain("expires_at");
    });

    it("쿠폰 코드 고유성 제약조건을 테스트할 때 중복 시 에러가 발생해야 함", async () => {
      // Given: 첫 번째 쿠폰 생성
      const duplicateCode = "DUPLICATE2024";
      await CouponFactory.createAndSave(couponRepository, {
        id: "coupon-001",
        couponCode: duplicateCode,
        name: "첫 번째 쿠폰",
      });

      // When & Then: 같은 쿠폰 코드로 두 번째 쿠폰 생성 시 에러 발생
      await expect(
        CouponFactory.createAndSave(couponRepository, {
          id: "coupon-002",
          couponCode: duplicateCode, // 중복 쿠폰 코드
          name: "두 번째 쿠폰",
        })
      ).rejects.toThrow();
    });

    it("여러 쿠폰 데이터로 테스트할 때 각각 올바르게 조회되어야 함", async () => {
      // Given: 여러 테스트 쿠폰들 생성
      const coupons = await CouponFactory.createManyAndSave(
        couponRepository,
        3
      );
      const authHeaders = await environment.dataHelper.getAuthHeaders();

      // When: 각 쿠폰을 개별적으로 조회
      for (const coupon of coupons) {
        const response = await request(app.getHttpServer())
          .get(`/api/coupons/${coupon.id}`)
          .set(authHeaders)
          .expect(200);

        // Then: 올바른 쿠폰 정보가 반환되어야 함
        expect(response.body.data.id).toBe(coupon.id);
        expect(response.body.data.name).toBe(coupon.name);
      }
    });
  });
});
