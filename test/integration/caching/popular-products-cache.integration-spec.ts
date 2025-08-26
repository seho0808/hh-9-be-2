import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { GetPopularProductsWithDetailWithCacheUseCase } from "../../../src/product/application/use-cases/tier-3/get-popular-products-with-detail-with-cache.use-case";
import { GetPopularProductsWithDetailUseCase } from "../../../src/product/application/use-cases/tier-2/get-popular-products-with-detail.use-case";
import { GetPopularProductsUseCase } from "../../../src/order/application/use-cases/tier-1-in-domain/get-popular-products.use-case";
import { GetProductsByIdsUseCase } from "../../../src/product/application/use-cases/tier-1-in-domain/get-products-by-ids.use-case";
import { CacheService } from "../../../src/common/infrastructure/cache/cache.service";
import { RedisManager } from "../../../src/common/infrastructure/config/redis.config";
import { OrderItemRepository } from "../../../src/order/infrastructure/persistence/order-item.repository";
import { ProductRepository } from "../../../src/product/infrastructure/persistence/product.repository";
import { OrderItemTypeOrmEntity } from "../../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { ProductTypeOrmEntity } from "../../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { OrderTypeOrmEntity } from "../../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { UserTypeOrmEntity } from "../../../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { CACHE_KEYS } from "../../../src/common/infrastructure/cache/cache-keys.constants";
import { OrderFactory } from "../../../src/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "../../../src/order/infrastructure/persistence/factories/order-item.factory";
import { ProductFactory } from "../../../src/product/infrastructure/persistence/factories/product.factory";
import { OrderStatus } from "../../../src/order/domain/entities/order.entitiy";

describe("Popular Products Cache Integration Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let getPopularProductsWithDetailWithCacheUseCase: GetPopularProductsWithDetailWithCacheUseCase;
  let cacheService: CacheService;
  let orderItemOrmRepository: Repository<OrderItemTypeOrmEntity>;
  let orderOrmRepository: Repository<OrderTypeOrmEntity>;
  let productOrmRepository: Repository<ProductTypeOrmEntity>;
  let userOrmRepository: Repository<UserTypeOrmEntity>;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();
    dataSource = environment.dataSource;

    orderItemOrmRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
    orderOrmRepository = dataSource.getRepository(OrderTypeOrmEntity);
    productOrmRepository = dataSource.getRepository(ProductTypeOrmEntity);
    userOrmRepository = dataSource.getRepository(UserTypeOrmEntity);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        // Cache
        RedisManager,
        CacheService,

        // Repositories
        {
          provide: getRepositoryToken(OrderItemTypeOrmEntity),
          useValue: orderItemOrmRepository,
        },
        {
          provide: getRepositoryToken(ProductTypeOrmEntity),
          useValue: productOrmRepository,
        },
        OrderItemRepository,
        ProductRepository,

        // Use Cases
        GetPopularProductsUseCase,
        GetProductsByIdsUseCase,
        GetPopularProductsWithDetailUseCase,
        GetPopularProductsWithDetailWithCacheUseCase,
        {
          provide: "POPULAR_PRODUCTS_QUERY_PORT",
          useExisting: OrderItemRepository,
        },
      ],
    }).compile();

    getPopularProductsWithDetailWithCacheUseCase =
      moduleFixture.get<GetPopularProductsWithDetailWithCacheUseCase>(
        GetPopularProductsWithDetailWithCacheUseCase
      );
    cacheService = moduleFixture.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.redisHelper.flushAll();
    OrderFactory.resetCounter();
    OrderItemFactory.resetCounter();
    ProductFactory.resetCounter();

    // CacheService를 통해서도 캐시 클리어 (완전한 격리를 위해)
    await cacheService.delPattern("*");
  });

  describe("인기 상품 캐싱", () => {
    it("첫 번째 호출에서는 DB 조회 후 캐시 저장, 두 번째 호출에서는 캐시 조회해야 함", async () => {
      // Given: 테스트 데이터 생성
      await setupPopularProductsTestData();

      // When: 첫 번째 호출 (캐시 미스)
      const firstResult =
        await getPopularProductsWithDetailWithCacheUseCase.execute({
          limit: 5,
        });

      // Then: 결과가 있어야 함
      expect(firstResult.popularProductsStats).toHaveLength(3);
      expect(firstResult.popularProductsStats[0].statistics.productId).toBe(
        "product-A"
      );

      // 캐시에 저장되었는지 확인
      const cachedData = await cacheService.get(CACHE_KEYS.POPULAR_PRODUCTS);
      expect(cachedData).toBeTruthy();

      // When: 두 번째 호출 (캐시 히트)
      const secondResult =
        await getPopularProductsWithDetailWithCacheUseCase.execute({
          limit: 5,
        });

      expect(secondResult).toEqual(firstResult);
    });

    it("캐시가 없을 때는 DB에서 조회해야 함", async () => {
      // Given: 테스트 데이터 생성
      await setupPopularProductsTestData();

      // 캐시가 비어있는지 확인
      const cachedData = await cacheService.get(CACHE_KEYS.POPULAR_PRODUCTS);
      expect(cachedData).toBeNull();

      // When
      const result = await getPopularProductsWithDetailWithCacheUseCase.execute(
        {
          limit: 3,
        }
      );

      // Then
      expect(result.popularProductsStats).toHaveLength(3);

      // Product A가 가장 인기 (총 수량 12)
      const topProduct = result.popularProductsStats[0];
      expect(topProduct.statistics.productId).toBe("product-A");
      expect(topProduct.statistics.totalQuantity).toBe(12);
    });

    it("캐시 무효화 후 새로운 데이터가 반영되어야 함", async () => {
      // Given: 초기 데이터 설정
      await setupPopularProductsTestData();

      // 첫 번째 호출로 캐시 생성
      const firstResult =
        await getPopularProductsWithDetailWithCacheUseCase.execute({
          limit: 3,
        });
      expect(firstResult.popularProductsStats).toHaveLength(3);

      // 새로운 주문 데이터 추가
      const newOrder = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-new",
        status: OrderStatus.SUCCESS,
        idempotencyKey: `new-popular-test-${Date.now()}`,
      });
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: newOrder.id,
        productId: "product-D", // 새로운 상품
        quantity: 20, // 많은 수량으로 1위 예상
      });

      // When: 캐시 무효화
      await cacheService.del(CACHE_KEYS.POPULAR_PRODUCTS);

      // 캐시 삭제 후 다시 호출
      const updatedResult =
        await getPopularProductsWithDetailWithCacheUseCase.execute({
          limit: 4,
        });

      // Then: 새로운 데이터가 반영되어야 함 (product-D가 1위)
      expect(updatedResult.popularProductsStats).toHaveLength(4); // 총 4개 상품
      // product-D가 가장 많은 수량으로 1위가 되어야 함
      const newTopProduct = updatedResult.popularProductsStats[0];
      expect(newTopProduct.statistics.productId).toBe("product-D");
      expect(newTopProduct.statistics.totalQuantity).toBe(20);
    });
  });

  /**
   * 인기 상품 테스트를 위한 데이터 설정
   */
  async function setupPopularProductsTestData() {
    // 사용자들 생성
    await userOrmRepository.save([
      {
        id: "user-1",
        email: "user1@test.com",
        password: "password",
        name: "User 1",
      },
      {
        id: "user-2",
        email: "user2@test.com",
        password: "password",
        name: "User 2",
      },
      {
        id: "user-3",
        email: "user3@test.com",
        password: "password",
        name: "User 3",
      },
      {
        id: "user-4",
        email: "user4@test.com",
        password: "password",
        name: "User 4",
      },
      {
        id: "user-new",
        email: "usernew@test.com",
        password: "password",
        name: "User New",
      },
    ]);

    // 상품들 생성
    await ProductFactory.createManyWithOptionsAndSave(productOrmRepository, [
      { id: "product-A", name: "Product A" },
      { id: "product-B", name: "Product B" },
      { id: "product-C", name: "Product C" },
      { id: "product-D", name: "Product D" },
    ]);

    // 성공한 주문들 생성
    const successOrders = await OrderFactory.createManyWithOptionsAndSave(
      orderOrmRepository,
      [
        {
          userId: "user-1",
          status: OrderStatus.SUCCESS,
          idempotencyKey: `popular-test-1-${Date.now()}`,
        },
        {
          userId: "user-2",
          status: OrderStatus.SUCCESS,
          idempotencyKey: `popular-test-2-${Date.now()}`,
        },
        {
          userId: "user-3",
          status: OrderStatus.SUCCESS,
          idempotencyKey: `popular-test-3-${Date.now()}`,
        },
        {
          userId: "user-4",
          status: OrderStatus.FAILED,
          idempotencyKey: `popular-test-4-${Date.now()}`,
        }, // 실패한 주문 (집계에서 제외)
      ]
    );

    const [successOrder1, successOrder2, successOrder3, failedOrder] =
      successOrders;

    // 주문 아이템들 생성
    await OrderItemFactory.createManyWithOptionsAndSave(
      orderItemOrmRepository,
      [
        // Product A: 총 수량 12 (3개 주문)
        { orderId: successOrder1.id, productId: "product-A", quantity: 5 },
        { orderId: successOrder2.id, productId: "product-A", quantity: 3 },
        { orderId: successOrder3.id, productId: "product-A", quantity: 4 },

        // Product B: 총 수량 8 (2개 주문)
        { orderId: successOrder1.id, productId: "product-B", quantity: 2 },
        { orderId: successOrder2.id, productId: "product-B", quantity: 6 },

        // Product C: 총 수량 3 (1개 주문)
        { orderId: successOrder3.id, productId: "product-C", quantity: 3 },

        // 실패한 주문의 아이템 (집계에서 제외되어야 함)
        { orderId: failedOrder.id, productId: "product-D", quantity: 100 },
      ]
    );
  }
});
