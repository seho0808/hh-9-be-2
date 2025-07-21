import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "./testcontainers-helper";
import { ProductFactory } from "../../src/product/infrastructure/persistence/factories/product.factory";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";

describe("Product API E2E (with TestContainers)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let testHelper: TestContainersHelper; // 인스턴스 추가

  beforeAll(async () => {
    testHelper = new TestContainersHelper(); // 인스턴스 생성
    const setup = await testHelper.setupWithMySQL();
    app = setup.app;
    dataSource = setup.dataSource;
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    // 각 테스트를 위한 기본 사용자 생성 (인증용)
    await testHelper.createTestUser(dataSource);
    // Factory counter 초기화
    ProductFactory.resetCounter();
  });

  describe("GET /api/products", () => {
    it("✅ 전체 상품 목록을 조회할 수 있어야 함", async () => {
      // Given: 테스트 상품들 생성
      await ProductFactory.createManyAndSave(productRepository, 3);
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 전체 상품 조회
      const response = await request(app.getHttpServer())
        .get("/api/products")
        .set(authHeaders)
        .expect(200);

      // Then: 상품 목록이 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
      expect(response.body.message).toBe("상품 목록을 성공적으로 조회했습니다");
    });

    it("✅ 페이지네이션이 올바르게 동작해야 함", async () => {
      // Given: 테스트 상품들 생성 (5개)
      await ProductFactory.createManyAndSave(productRepository, 5);
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 2페이지, 2개씩 조회
      const response = await request(app.getHttpServer())
        .get("/api/products?page=2&limit=2")
        .set(authHeaders)
        .expect(200);

      // Then: 페이지네이션이 올바르게 적용되어야 함
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.total).toBe(5);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(2);
    });

    it("✅ 활성화 상태 필터가 올바르게 동작해야 함", async () => {
      // Given: 활성/비활성 상품들 생성
      await ProductFactory.createManyAndSave(productRepository, 3, {
        isActive: true,
      });
      await ProductFactory.createManyAndSave(productRepository, 2, {
        isActive: false,
      });
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 활성화된 상품만 조회
      const response = await request(app.getHttpServer())
        .get("/api/products?isActive=true&page=1&limit=10")
        .set(authHeaders)
        .expect(200);

      // Then: 활성화된 상품만 반환되어야 함
      expect(response.body.data.items).toHaveLength(3);
      response.body.data.items.forEach((product: any) => {
        expect(product.isActive).toBe(true);
      });
    });

    it("✅ 검색 필터가 올바르게 동작해야 함", async () => {
      // Given: 특정 이름의 상품 생성
      await ProductFactory.createAndSave(productRepository, {
        id: "search-test-1",
        name: "iPhone 15 Pro",
        description: "애플의 최신 스마트폰",
      });
      await ProductFactory.createAndSave(productRepository, {
        id: "search-test-2",
        name: "Galaxy S24",
        description: "삼성의 플래그십",
      });
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: "iPhone" 검색
      const response = await request(app.getHttpServer())
        .get("/api/products?search=iPhone")
        .set(authHeaders)
        .expect(200);

      // Then: iPhone이 포함된 상품만 반환되어야 함
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toContain("iPhone");
    });

    it("❌ 토큰 없이 접근하면 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 상품 목록 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/products")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("GET /api/products/popular", () => {
    it.skip("✅ 인기 상품 목록을 조회할 수 있어야 함", async () => {
      // TODO: order application service 구현 후 테스트 코드 작성
    });

    it.skip("✅ 인기 상품은 최대 5개까지 반환되어야 함", async () => {
      // TODO: order application service 구현 후 테스트 코드 작성
    });

    it("❌ 토큰 없이 접근하면 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 인기 상품 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/products/popular")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("GET /api/products/:productId", () => {
    it("✅ 특정 상품을 조회할 수 있어야 함", async () => {
      // Given: 테스트 상품 생성
      const testProduct = await ProductFactory.createAndSave(
        productRepository,
        {
          id: "test-product-detail",
          name: "상세 조회 테스트 상품",
          description: "상세 조회용 테스트 상품입니다",
          price: 50000,
          totalStock: 100,
          reservedStock: 10,
        }
      );
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 특정 상품 조회
      const response = await request(app.getHttpServer())
        .get(`/api/products/${testProduct.id}`)
        .set(authHeaders)
        .expect(200);

      // Then: 상품 정보가 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testProduct.id,
        name: testProduct.name,
        description: testProduct.description,
        price: testProduct.price,
        totalStock: testProduct.totalStock,
        reservedStock: testProduct.reservedStock,
        isActive: testProduct.isActive,
        availableStock: testProduct.totalStock - testProduct.reservedStock,
      });
      expect(response.body.message).toBe("상품을 성공적으로 조회했습니다");
    });

    it("❌ 존재하지 않는 상품 조회 시 404 에러가 발생해야 함", async () => {
      // Given: 인증 헤더 준비
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 존재하지 않는 상품 조회
      const response = await request(app.getHttpServer())
        .get("/api/products/non-existent-product")
        .set(authHeaders)
        .expect(404);

      // Then: 상품을 찾을 수 없다는 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("상품을 찾을 수 없습니다.");
    });

    it("❌ 토큰 없이 접근하면 401 에러가 발생해야 함", async () => {
      // Given: 테스트 상품 생성
      const testProduct = await ProductFactory.createAndSave(productRepository);

      // When: 토큰 없이 상품 조회 시도
      const response = await request(app.getHttpServer())
        .get(`/api/products/${testProduct.id}`)
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });

    it("❌ 잘못된 토큰으로 접근하면 401 에러가 발생해야 함", async () => {
      // Given: 테스트 상품 생성
      const testProduct = await ProductFactory.createAndSave(productRepository);

      // When: 잘못된 토큰으로 상품 조회 시도
      const response = await request(app.getHttpServer())
        .get(`/api/products/${testProduct.id}`)
        .set(testHelper.getInvalidAuthHeaders())
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("유효하지 않은 토큰입니다");
    });
  });

  describe("Database Integration", () => {
    it("📊 상품 생성 후 조회가 제대로 동작해야 함", async () => {
      // Given: 헬퍼를 사용해 테스트 상품 생성
      const productData = await ProductFactory.createAndSave(
        productRepository,
        {
          id: "integration-test-product",
          name: "통합테스트 상품",
          description: "통합테스트용 상품입니다",
          price: 99000,
          totalStock: 50,
          reservedStock: 5,
          isActive: true,
        }
      );

      // When: DB에서 직접 조회
      const dbResult = await productRepository.findOne({
        where: { id: productData.id },
      });

      // Then: 데이터가 올바르게 저장되고 조회되어야 함
      expect(dbResult).toBeDefined();
      expect(dbResult!.name).toBe(productData.name);
      expect(dbResult!.price).toBe(productData.price);
      expect(dbResult!.totalStock).toBe(productData.totalStock);
    });

    it("🔧 DB 연결 상태 및 테이블 구조 확인", async () => {
      // DB 연결 확인
      const isConnected = await testHelper.verifyDatabaseConnection(dataSource);
      expect(isConnected).toBe(true);

      // 테이블 존재 확인
      const result = await dataSource.query("SHOW TABLES");
      const tableNames = result.map((row: any) => Object.values(row)[0]);
      expect(tableNames).toContain("products");

      // 상품 테이블 구조 확인
      const columns = await testHelper.getTableInfo(dataSource, "products");
      const columnNames = columns.map((col: any) => col.Field);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("description");
      expect(columnNames).toContain("price");
      expect(columnNames).toContain("total_stock");
      expect(columnNames).toContain("reserved_stock");
      expect(columnNames).toContain("is_active");
    });

    it("🔍 상품명 고유성 제약조건 테스트", async () => {
      // Given: 첫 번째 상품 생성
      const duplicateName = "중복 테스트 상품";
      await ProductFactory.createAndSave(productRepository, {
        id: "product-001",
        name: duplicateName,
        description: "첫 번째 상품",
      });

      // When & Then: 같은 이름으로 두 번째 상품 생성 시 에러 발생
      await expect(
        ProductFactory.createAndSave(productRepository, {
          id: "product-002",
          name: duplicateName, // 중복 상품명
          description: "두 번째 상품",
        })
      ).rejects.toThrow();
    });

    it("🔄 여러 상품 데이터로 테스트", async () => {
      // Given: 여러 테스트 상품들 생성
      const products = await ProductFactory.createManyAndSave(
        productRepository,
        3
      );
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 각 상품을 개별적으로 조회
      for (const product of products) {
        const response = await request(app.getHttpServer())
          .get(`/api/products/${product.id}`)
          .set(authHeaders)
          .expect(200);

        // Then: 올바른 상품 정보가 반환되어야 함
        expect(response.body.data.id).toBe(product.id);
        expect(response.body.data.name).toBe(product.name);
      }
    });
  });
});
