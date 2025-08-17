import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { GetOrdersByUserIdWithCacheUseCase } from "../../../src/order/application/use-cases/tier-2/get-orders-by-user-id-with-cache.use-case";
import { GetOrdersByUserIdUseCase } from "../../../src/order/application/use-cases/tier-1-in-domain/get-orders-by-user-id.use-case";
import { CreateOrderUseCase } from "../../../src/order/application/use-cases/tier-1-in-domain/create-order.use-case";
import { CacheService } from "../../../src/common/infrastructure/cache/cache.service";
import { CacheInvalidationService } from "../../../src/common/infrastructure/cache/cache-invalidation.service";
import { RedisManager } from "../../../src/common/infrastructure/config/redis.config";
import { OrderRepository } from "../../../src/order/infrastructure/persistence/order.repository";
import { OrderItemRepository } from "../../../src/order/infrastructure/persistence/order-item.repository";
import { OrderTypeOrmEntity } from "../../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { UserTypeOrmEntity } from "../../../src/user/infrastructure/persistence/orm/user.typeorm.entity";
import { ProductTypeOrmEntity } from "../../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { CACHE_KEYS } from "../../../src/common/infrastructure/cache/cache-keys.constants";
import { OrderFactory } from "../../../src/order/infrastructure/persistence/factories/order.factory";
import { OrderStatus } from "../../../src/order/domain/entities/order.entitiy";

describe("User Orders Cache Integration Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let getOrdersByUserIdWithCacheUseCase: GetOrdersByUserIdWithCacheUseCase;
  let createOrderUseCase: CreateOrderUseCase;
  let cacheService: CacheService;
  let orderOrmRepository: Repository<OrderTypeOrmEntity>;
  let orderItemOrmRepository: Repository<OrderItemTypeOrmEntity>;
  let userOrmRepository: Repository<UserTypeOrmEntity>;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();
    dataSource = environment.dataSource;

    orderOrmRepository = dataSource.getRepository(OrderTypeOrmEntity);
    orderItemOrmRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
    userOrmRepository = dataSource.getRepository(UserTypeOrmEntity);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        // Cache
        RedisManager,
        CacheService,
        CacheInvalidationService,

        // Repositories
        {
          provide: getRepositoryToken(OrderTypeOrmEntity),
          useValue: orderOrmRepository,
        },
        {
          provide: getRepositoryToken(OrderItemTypeOrmEntity),
          useValue: orderItemOrmRepository,
        },
        OrderRepository,
        OrderItemRepository,

        // Use Cases
        GetOrdersByUserIdUseCase,
        GetOrdersByUserIdWithCacheUseCase,
        CreateOrderUseCase,
      ],
    }).compile();

    getOrdersByUserIdWithCacheUseCase =
      moduleFixture.get<GetOrdersByUserIdWithCacheUseCase>(
        GetOrdersByUserIdWithCacheUseCase
      );
    createOrderUseCase =
      moduleFixture.get<CreateOrderUseCase>(CreateOrderUseCase);
    cacheService = moduleFixture.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.redisHelper.flushAll();
    OrderFactory.resetCounter();

    // 테스트용 사용자들 생성
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
        id: "other-user",
        email: "other@test.com",
        password: "password",
        name: "Other User",
      },
    ]);

    // 테스트용 상품들 생성 (주문 아이템에서 참조할 상품)
    const productOrmRepository = dataSource.getRepository(ProductTypeOrmEntity);
    await productOrmRepository.save([
      {
        id: "product-1",
        name: "Test Product 1",
        description: "Test Product 1 Description",
        price: 1000,
        totalStock: 100,
        reservedStock: 0,
        isActive: true,
      },
    ]);
  });

  describe("사용자 주문 이력 캐싱", () => {
    it("첫 번째 호출에서는 DB 조회 후 캐시 저장, 두 번째 호출에서는 캐시 조회해야 함", async () => {
      // Given: 사용자 주문 데이터 생성
      const userId = `test-${Math.random().toString(36).substring(2, 8)}`; // 짧은 유니크 ID
      // 추가 테스트 사용자 생성
      await userOrmRepository.save({
        id: userId,
        email: `${userId}@test.com`,
        password: "password",
        name: "Test User",
      });
      await createTestOrders(userId, 3);

      // When: 첫 번째 호출 (캐시 미스)
      const firstResult =
        await getOrdersByUserIdWithCacheUseCase.execute(userId);

      // Then: 결과가 있어야 함
      expect(firstResult).toHaveLength(3);
      expect(firstResult[0].userId).toBe(userId);

      // 캐시에 저장되었는지 확인
      const cachedData = await cacheService.get(CACHE_KEYS.USER_ORDERS(userId));
      expect(cachedData).toBeTruthy();
      expect((cachedData as any).orders).toHaveLength(3);

      // When: 두 번째 호출 (캐시 히트)
      const secondResult =
        await getOrdersByUserIdWithCacheUseCase.execute(userId);

      expect(secondResult).toHaveLength(3);
      expect(secondResult[0].id).toBe(firstResult[0].id);
    });

    it("새 주문 생성 시 사용자 주문 캐시가 무효화되어야 함", async () => {
      // Given: 기존 주문 데이터 및 캐시 생성
      const userId = `inv-${Math.random().toString(36).substring(2, 8)}`;
      // 추가 테스트 사용자 생성
      await userOrmRepository.save({
        id: userId,
        email: `${userId}@test.com`,
        password: "password",
        name: "Test User Invalidation",
      });
      await createTestOrders(userId, 2);

      // 첫 번째 호출로 캐시 생성
      const initialOrders =
        await getOrdersByUserIdWithCacheUseCase.execute(userId);
      expect(initialOrders).toHaveLength(2);

      // 캐시가 존재하는지 확인
      const cachedData = await cacheService.get(CACHE_KEYS.USER_ORDERS(userId));
      expect(cachedData).toBeTruthy();

      // When: 새 주문 생성 (캐시 무효화 트리거)
      await createOrderUseCase.execute({
        userId,
        idempotencyKey: "new-order-key",
        items: [{ productId: "product-1", unitPrice: 1000, quantity: 1 }],
      });

      // Then: 캐시가 무효화되었는지 확인
      const invalidatedCache = await cacheService.get(
        CACHE_KEYS.USER_ORDERS(userId)
      );
      expect(invalidatedCache).toBeNull();

      // 다시 조회하면 새로운 주문이 포함된 결과 반환
      const updatedOrders =
        await getOrdersByUserIdWithCacheUseCase.execute(userId);
      expect(updatedOrders).toHaveLength(3); // 기존 2개 + 새로운 1개
    });

    it("다른 사용자의 주문 생성은 현재 사용자 캐시에 영향을 주지 않아야 함", async () => {
      // Given: 두 사용자의 주문 데이터 생성
      const user1 = "user-1";
      const user2 = "user-2";

      await createTestOrders(user1, 2);
      await createTestOrders(user2, 3);

      // 두 사용자 모두 캐시 생성
      await getOrdersByUserIdWithCacheUseCase.execute(user1);
      await getOrdersByUserIdWithCacheUseCase.execute(user2);

      // 캐시 존재 확인
      const user1Cache = await cacheService.get(CACHE_KEYS.USER_ORDERS(user1));
      const user2Cache = await cacheService.get(CACHE_KEYS.USER_ORDERS(user2));
      expect(user1Cache).toBeTruthy();
      expect(user2Cache).toBeTruthy();

      // When: user2가 새 주문 생성
      await createOrderUseCase.execute({
        userId: user2,
        idempotencyKey: "user2-new-order",
        items: [{ productId: "product-1", unitPrice: 1000, quantity: 1 }],
      });

      // Then: user1의 캐시는 영향 받지 않아야 함
      const user1CacheAfter = await cacheService.get(
        CACHE_KEYS.USER_ORDERS(user1)
      );
      const user2CacheAfter = await cacheService.get(
        CACHE_KEYS.USER_ORDERS(user2)
      );

      expect(user1CacheAfter).toBeTruthy(); // user1 캐시는 유지
      expect(user2CacheAfter).toBeNull(); // user2 캐시만 무효화
    });
  });

  /**
   * 테스트용 주문 데이터 생성
   */
  async function createTestOrders(userId: string, count: number) {
    const orders = [];
    for (let i = 0; i < count; i++) {
      const order = await OrderFactory.createAndSave(orderOrmRepository, {
        userId,
        status: OrderStatus.SUCCESS,
        idempotencyKey: `test-order-${userId}-${i}-${Date.now()}`, // 유니크한 키 생성
      });
      orders.push(order);
    }
    return orders;
  }
});
