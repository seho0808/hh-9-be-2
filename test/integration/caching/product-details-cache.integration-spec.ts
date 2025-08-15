import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { GetProductByIdWithCacheUseCase } from "../../../src/product/application/use-cases/tier-2/get-product-by-id-with-cache.use-case";
import { GetProductByIdUseCase } from "../../../src/product/application/use-cases/tier-1-in-domain/get-product-by-id.use-case";
import { CacheService } from "../../../src/common/infrastructure/cache/cache.service";
import { CacheInvalidationService } from "../../../src/common/infrastructure/cache/cache-invalidation.service";
import { RedisManager } from "../../../src/common/infrastructure/config/redis.config";
import { ProductRepository } from "../../../src/product/infrastructure/persistence/product.repository";
import { ProductTypeOrmEntity } from "../../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { CACHE_KEYS } from "../../../src/common/infrastructure/cache/cache-keys.constants";
import { ProductFactory } from "../../../src/product/infrastructure/persistence/factories/product.factory";
import { ProductNotFoundError } from "../../../src/product/application/product.application.exceptions";

describe("Product Details Cache Integration Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let getProductByIdWithCacheUseCase: GetProductByIdWithCacheUseCase;
  let cacheService: CacheService;
  let cacheInvalidationService: CacheInvalidationService;
  let productOrmRepository: Repository<ProductTypeOrmEntity>;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();
    dataSource = environment.dataSource;

    productOrmRepository = dataSource.getRepository(ProductTypeOrmEntity);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        // Cache
        RedisManager,
        CacheService,
        CacheInvalidationService,

        // Repositories
        {
          provide: getRepositoryToken(ProductTypeOrmEntity),
          useValue: productOrmRepository,
        },
        ProductRepository,

        // Use Cases
        GetProductByIdUseCase,
        GetProductByIdWithCacheUseCase,
      ],
    }).compile();

    getProductByIdWithCacheUseCase =
      moduleFixture.get<GetProductByIdWithCacheUseCase>(
        GetProductByIdWithCacheUseCase
      );
    cacheService = moduleFixture.get<CacheService>(CacheService);
    cacheInvalidationService = moduleFixture.get<CacheInvalidationService>(
      CacheInvalidationService
    );
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.redisHelper.flushAll();
    ProductFactory.resetCounter();
  });

  describe("상품 상세 정보 캐싱", () => {
    it("첫 번째 호출에서는 DB 조회 후 캐시 저장, 두 번째 호출에서는 캐시 활용해야 함", async () => {
      // Given: 테스트 상품 생성
      const product = await ProductFactory.createAndSave(productOrmRepository, {
        id: "test-product-123",
        name: "Test Product",
        description: "Test Description",
        price: 10000,
        totalStock: 100,
        reservedStock: 10,
        isActive: true,
      });

      // When: 첫 번째 호출 (캐시 미스)
      const firstResult = await getProductByIdWithCacheUseCase.execute(
        product.id
      );

      // Then: 올바른 상품 정보 반환
      expect(firstResult.id).toBe(product.id);
      expect(firstResult.name).toBe("Test Product");
      expect(firstResult.price).toBe(10000);

      // 캐시에 기본 정보만 저장되었는지 확인 (재고 정보 제외)
      const cachedData = await cacheService.get(
        CACHE_KEYS.PRODUCT_DETAILS(product.id)
      );
      expect(cachedData).toBeTruthy();
      expect((cachedData as any).id).toBe(product.id);
      expect((cachedData as any).name).toBe("Test Product");
      expect((cachedData as any).price).toBe(10000);

      // When: 두 번째 호출 (캐시 히트)
      const secondResult = await getProductByIdWithCacheUseCase.execute(
        product.id
      );

      // Then: 같은 결과 반환하되, 실시간 재고 정보도 포함
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.totalStock).toBe(100); // 실시간 재고 정보
      expect(secondResult.reservedStock).toBe(10);
    });

    it("존재하지 않는 상품 조회 시 예외가 발생해야 함", async () => {
      // When & Then
      await expect(
        getProductByIdWithCacheUseCase.execute("nonexistent-product")
      ).rejects.toThrow(ProductNotFoundError);

      // 캐시에도 저장되지 않아야 함
      const cachedData = await cacheService.get(
        CACHE_KEYS.PRODUCT_DETAILS("nonexistent-product")
      );
      expect(cachedData).toBeNull();
    });

    it("캐시 무효화 후 새로운 데이터가 반영되어야 함", async () => {
      // Given: 초기 상품 생성
      const product = await ProductFactory.createAndSave(productOrmRepository, {
        id: "test-product-456",
        name: "Original Name",
        price: 5000,
        isActive: true,
      });

      // 첫 번째 호출로 캐시 생성
      const firstResult = await getProductByIdWithCacheUseCase.execute(
        product.id
      );
      expect(firstResult.name).toBe("Original Name");
      expect(firstResult.price).toBe(5000);

      // 캐시 존재 확인
      const cachedData = await cacheService.get(
        CACHE_KEYS.PRODUCT_DETAILS(product.id)
      );
      expect(cachedData).toBeTruthy();

      // DB에서 상품 정보 직접 수정 (실제로는 별도 use case에서 처리)
      await productOrmRepository.update(product.id, {
        name: "Updated Name",
        price: 7000,
      });

      // When: 캐시 무효화
      await cacheInvalidationService.invalidateProductCache(product.id);

      // 캐시가 삭제되었는지 확인
      const invalidatedCache = await cacheService.get(
        CACHE_KEYS.PRODUCT_DETAILS(product.id)
      );
      expect(invalidatedCache).toBeNull();

      // Then: 다시 조회하면 업데이트된 정보가 반환되어야 함
      const updatedResult = await getProductByIdWithCacheUseCase.execute(
        product.id
      );
      expect(updatedResult.name).toBe("Updated Name");
      expect(updatedResult.price).toBe(7000);

      // 새로운 정보가 다시 캐시되었는지 확인
      const newCachedData = await cacheService.get(
        CACHE_KEYS.PRODUCT_DETAILS(product.id)
      );
      expect(newCachedData).toBeTruthy();
      expect((newCachedData as any).name).toBe("Updated Name");
      expect((newCachedData as any).price).toBe(7000);
    });

    it("여러 상품 캐시를 일괄 무효화할 수 있어야 함", async () => {
      // Given: 여러 상품 생성 및 캐시
      const products = await ProductFactory.createManyWithOptionsAndSave(
        productOrmRepository,
        [
          { id: "product-1", name: "Product 1" },
          { id: "product-2", name: "Product 2" },
          { id: "product-3", name: "Product 3" },
        ]
      );

      // 모든 상품 캐시 생성
      for (const product of products) {
        await getProductByIdWithCacheUseCase.execute(product.id);
      }

      // 캐시 존재 확인
      for (const product of products) {
        const cachedData = await cacheService.get(
          CACHE_KEYS.PRODUCT_DETAILS(product.id)
        );
        expect(cachedData).toBeTruthy();
      }

      // When: 여러 상품 캐시 일괄 무효화
      const productIds = products.map((p) => p.id);
      await cacheInvalidationService.invalidateMultipleProductsCache(
        productIds
      );

      // Then: 모든 캐시가 삭제되어야 함
      for (const product of products) {
        const invalidatedCache = await cacheService.get(
          CACHE_KEYS.PRODUCT_DETAILS(product.id)
        );
        expect(invalidatedCache).toBeNull();
      }
    });
  });
});
