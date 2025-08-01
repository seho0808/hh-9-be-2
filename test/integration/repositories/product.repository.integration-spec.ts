import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { ProductRepository } from "../../../src/product/infrastructure/persistence/product.repository";
import { ProductTypeOrmEntity } from "../../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { ProductFactory } from "../../../src/product/infrastructure/persistence/factories/product.factory";

describe("ProductRepository Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let productRepository: ProductRepository;
  let productOrmRepository: Repository<ProductTypeOrmEntity>;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupDatabaseOnly();
    dataSource = setup.dataSource;

    productOrmRepository = dataSource.getRepository(ProductTypeOrmEntity);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(ProductTypeOrmEntity),
          useValue: productOrmRepository,
        },
        ProductRepository,
      ],
    }).compile();

    productRepository = moduleFixture.get<ProductRepository>(ProductRepository);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    ProductFactory.resetCounter();
  });

  describe("findPaginated", () => {
    it("활성화 상태 필터링이 올바르게 작동해야 함", async () => {
      // Given: 활성화된 상품과 비활성화된 상품들 벌크 생성
      await ProductFactory.createManyWithOptionsAndSave(productOrmRepository, [
        {
          name: "Active Product 1",
          isActive: true,
        },
        {
          name: "Active Product 2",
          isActive: true,
        },
        {
          name: "Inactive Product",
          isActive: false,
        },
      ]);

      // When: 활성화된 상품만 조회
      const result = await productRepository.findPaginated(0, 10, {
        isActive: true,
      });

      // Then: 활성화된 상품만 반환되어야 함
      expect(result.total).toBe(2);
      expect(result.products).toHaveLength(2);
      expect(result.products.every((p) => p.isActive)).toBe(true);
    });

    it("검색 키워드 필터링이 이름과 설명에서 모두 작동해야 함", async () => {
      // Given: 다양한 이름과 설명을 가진 상품들 벌크 생성
      await ProductFactory.createManyWithOptionsAndSave(productOrmRepository, [
        {
          name: "Apple iPhone",
          description: "스마트폰",
          isActive: true,
        },
        {
          name: "Samsung Galaxy",
          description: "애플 대체품",
          isActive: true,
        },
        {
          name: "Google Pixel",
          description: "구글 스마트폰",
          isActive: true,
        },
      ]);

      // When: "애플" 키워드로 검색
      const result = await productRepository.findPaginated(0, 10, {
        search: "애플",
      });

      // Then: 이름 또는 설명에 "애플"이 포함된 상품들이 반환되어야 함
      expect(result.total).toBe(1);
      expect(result.products).toHaveLength(1);
    });

    it("복합 필터링 (활성화 + 검색)이 올바르게 작동해야 함", async () => {
      // Given: 복합 조건을 테스트할 상품들 벌크 생성
      await ProductFactory.createManyWithOptionsAndSave(productOrmRepository, [
        {
          name: "Active Laptop",
          description: "활성화된 노트북",
          isActive: true,
        },
        {
          name: "Inactive Laptop",
          description: "비활성화된 노트북",
          isActive: false,
        },
        {
          name: "Active Phone",
          description: "활성화된 스마트폰",
          isActive: true,
        },
      ]);

      // When: 활성화되고 "노트북"이 포함된 상품 검색
      const result = await productRepository.findPaginated(0, 10, {
        isActive: true,
        search: "노트북",
      });

      // Then: 조건에 맞는 상품만 반환되어야 함
      expect(result.total).toBe(1);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe("Active Laptop");
      expect(result.products[0].isActive).toBe(true);
    });

    it("페이지네이션이 올바르게 작동해야 함", async () => {
      // Given: 15개의 상품 벌크 생성
      const totalProducts = 15;
      const productOptions = Array.from({ length: totalProducts }, (_, i) => ({
        name: `Product ${i + 1}`,
        isActive: true,
      }));

      await ProductFactory.createManyWithOptionsAndSave(
        productOrmRepository,
        productOptions
      );

      // When: 첫 번째 페이지 (5개씩)
      const page1 = await productRepository.findPaginated(0, 5);

      // Then: 첫 번째 페이지 결과 검증
      expect(page1.total).toBe(15);
      expect(page1.products).toHaveLength(5);

      // When: 두 번째 페이지
      const page2 = await productRepository.findPaginated(5, 5);

      // Then: 두 번째 페이지 결과 검증
      expect(page2.total).toBe(15);
      expect(page2.products).toHaveLength(5);

      // When: 마지막 페이지
      const page3 = await productRepository.findPaginated(10, 5);

      // Then: 마지막 페이지 결과 검증
      expect(page3.total).toBe(15);
      expect(page3.products).toHaveLength(5);

      // 모든 상품이 중복 없이 반환되는지 확인
      const allProductIds = [
        ...page1.products.map((p) => p.id),
        ...page2.products.map((p) => p.id),
        ...page3.products.map((p) => p.id),
      ];
      const uniqueIds = new Set(allProductIds);
      expect(uniqueIds.size).toBe(15);
    });

    it("빈 검색 결과를 올바르게 처리해야 함", async () => {
      // Given: 검색에 매치되지 않는 상품
      await ProductFactory.createAndSave(productOrmRepository, {
        name: "Apple iPhone",
        description: "스마트폰",
        isActive: true,
      });

      // When: 매치되지 않는 키워드로 검색
      const result = await productRepository.findPaginated(0, 10, {
        search: "존재하지않는검색어",
      });

      // Then: 빈 결과가 반환되어야 함
      expect(result.total).toBe(0);
      expect(result.products).toHaveLength(0);
    });

    it("LIKE 쿼리의 SQL 인젝션 방지가 작동해야 함", async () => {
      // Given: 정상적인 상품
      await ProductFactory.createAndSave(productOrmRepository, {
        name: "Normal Product",
        description: "정상적인 상품",
        isActive: true,
      });

      // When: SQL 인젝션 시도가 포함된 검색어
      const maliciousSearch = "'; DROP TABLE products; --";
      const result = await productRepository.findPaginated(0, 10, {
        search: maliciousSearch,
      });

      // Then: 안전하게 처리되어 빈 결과 반환
      expect(result.total).toBe(0);
      expect(result.products).toHaveLength(0);

      // 테이블이 여전히 존재하는지 확인
      const allProducts = await productRepository.findPaginated(0, 10);
      expect(allProducts.total).toBe(1);
    });

    it("대소문자 구분 없는 검색이 작동해야 함", async () => {
      // Given: 대소문자가 섞인 상품명
      await ProductFactory.createAndSave(productOrmRepository, {
        name: "iPhone Pro Max",
        description: "Apple 스마트폰",
        isActive: true,
      });

      // When: 소문자로 검색
      const result = await productRepository.findPaginated(0, 10, {
        search: "iphone",
      });

      // Then: 대소문자 구분 없이 검색되어야 함
      expect(result.total).toBe(1);
      expect(result.products[0].name).toBe("iPhone Pro Max");
    });

    it("특수문자가 포함된 검색어 처리가 올바르게 작동해야 함", async () => {
      // Given: 특수문자가 포함된 상품
      await ProductFactory.createAndSave(productOrmRepository, {
        name: "Pro+ Version 2.0",
        description: "업그레이드된 버전",
        isActive: true,
      });

      // When: 특수문자를 포함한 검색
      const result = await productRepository.findPaginated(0, 10, {
        search: "Pro+",
      });

      // Then: 특수문자가 포함된 검색도 정상 작동
      expect(result.total).toBe(1);
      expect(result.products[0].name).toBe("Pro+ Version 2.0");
    });

    it("동일한 수량 상품들의 정렬 순서가 일관성 있게 작동해야 함", async () => {
      // Given: 동일한 조건의 상품들 벌크 생성 (이름 정렬 테스트용)
      await ProductFactory.createManyWithOptionsAndSave(productOrmRepository, [
        { name: "Product C", isActive: true },
        { name: "Product A", isActive: true },
        { name: "Product B", isActive: true },
      ]);

      // When: 여러 번 조회
      const result1 = await productRepository.findPaginated(0, 10);
      const result2 = await productRepository.findPaginated(0, 10);

      // Then: 동일한 순서로 반환되어야 함 (일관성)
      expect(result1.products.map((p) => p.name)).toEqual(
        result2.products.map((p) => p.name)
      );
      expect(result1.products).toHaveLength(3);
    });

    it("limit이 0일 때 빈 결과를 반환해야 함", async () => {
      // Given: 상품들 생성
      await ProductFactory.createManyAndSave(productOrmRepository, 5, {
        isActive: true,
      });

      // When: limit 0으로 조회
      const result = await productRepository.findPaginated(0, 0);

      // Then: 빈 배열 반환되지만 total은 정확해야 함
      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(5);
    });

    it("매우 큰 offset 값 처리가 올바르게 작동해야 함", async () => {
      // Given: 5개의 상품만 생성
      await ProductFactory.createManyAndSave(productOrmRepository, 5, {
        isActive: true,
      });

      // When: 존재하지 않는 페이지 조회 (offset > total)
      const result = await productRepository.findPaginated(100, 10);

      // Then: 빈 결과 반환되지만 total은 정확해야 함
      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(5);
    });
  });
});
