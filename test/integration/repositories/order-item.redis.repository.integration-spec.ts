import { Test, TestingModule } from "@nestjs/testing";
import { OrderItemRedisRepository } from "@/order/infrastructure/persistence/order-item-redis.repository";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { RedisManager } from "@/common/infrastructure/config/redis.config";
import { TestRedisConfig } from "../../test-environment/mocks/redis.config";

describe("OrderItemRedisRepository 통합 테스트 (Redis)", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let redisManager: RedisManager;
  let repository: OrderItemRedisRepository;

  // Keep these in sync with repository defaults
  const rollupDays = 3;
  const rollupKeyPrefix = "popular_products:rollup";

  const todayKey = () => `${rollupKeyPrefix}:today`;
  const fullRollupKey = () => `${rollupKeyPrefix}:${rollupDays}day`;
  const dateToKey = (date: Date) =>
    `${rollupKeyPrefix}:${date.toISOString().split("T")[0].replace(/-/g, "")}`;
  const yesterdayKey = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return dateToKey(yesterday);
  };
  const oldestDayKey = () => {
    const now = new Date();
    const oldest = new Date(now.getTime() - 24 * 60 * 60 * 1000 * rollupDays);
    return dateToKey(oldest);
  };

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createRedisOnlyEnvironment();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RedisManager,
          useValue: new TestRedisConfig(environment.redisContainer!),
        },
        OrderItemRedisRepository,
      ],
    }).compile();

    redisManager = moduleFixture.get<RedisManager>(RedisManager);
    repository = moduleFixture.get<OrderItemRedisRepository>(
      OrderItemRedisRepository
    );
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.redisHelper.flushAll();
  });

  describe("updatePopularProducts와 getPopularProducts", () => {
    it("수량을 누적하고 상위 상품을 내림차순으로 반환해야 한다", async () => {
      // Given
      await repository.updatePopularProducts("product-A", 5);
      await repository.updatePopularProducts("product-B", 3);
      await repository.updatePopularProducts("product-A", 2); // A total: 7

      // When
      const top = await repository.findPopularProducts(5);

      // Then
      expect(top).toEqual([
        { productId: "product-A", totalQuantity: 7 },
        { productId: "product-B", totalQuantity: 3 },
      ]);
    });

    it("limit 파라미터를 준수해야 한다", async () => {
      await repository.updatePopularProducts("p1", 10);
      await repository.updatePopularProducts("p2", 9);
      await repository.updatePopularProducts("p3", 8);

      const top2 = await repository.findPopularProducts(2);
      expect(top2).toHaveLength(2);
      expect(top2[0].productId).toBe("p1");
      expect(top2[1].productId).toBe("p2");
    });
  });

  describe("midnightRollOver 동작", () => {
    it("가장 오래된 날짜가 없을 때 today 키를 어제 날짜 키로 변경하고 전체 롤업은 유지되어야 한다", async () => {
      const redis = redisManager.getClient();

      // Given
      await repository.updatePopularProducts("product-A", 5);

      // Pre-conditions
      expect(await redis.exists(todayKey())).toBe(1);
      expect(await redis.exists(yesterdayKey())).toBe(0);

      // When
      await repository.midnightRollOver();

      // Then
      expect(await redis.exists(todayKey())).toBe(0);
      expect(await redis.exists(yesterdayKey())).toBe(1);

      const yesterdayMembers = await redis.zrevrange(
        yesterdayKey(),
        0,
        -1,
        "WITHSCORES"
      );
      expect(yesterdayMembers).toEqual(["product-A", "5"]);

      const ttl = await redis.ttl(yesterdayKey());
      expect(ttl).toBeGreaterThan(0);

      const full = await redis.zrevrange(fullRollupKey(), 0, -1, "WITHSCORES");
      expect(full).toEqual(["product-A", "5"]);
    });
  });

  describe("oldestDayRollup 동작", () => {
    it("음수 가중치를 사용해 전체 롤업에서 가장 오래된 날짜 zset 값을 차감해야 한다", async () => {
      const redis = redisManager.getClient();

      // Given: seed full rollup
      await redis.zadd(fullRollupKey(), 10, "product-A");
      await redis.zadd(fullRollupKey(), 5, "product-C");

      // And: create oldest day key with contributions to subtract
      await redis.zadd(oldestDayKey(), 3, "product-A");
      await redis.zadd(oldestDayKey(), 5, "product-C");

      // When
      await repository["oldestDayRollup"]();

      // Then
      const after = await redis.zrevrange(fullRollupKey(), 0, -1, "WITHSCORES");
      // A: 10 - 3 = 7, C: 5 - 5 = 0 (may remain with score 0)
      expect(after).toContain("product-A");
      expect(after).toContain("7");
      // Zero-score members are allowed; ensure not negative
      const cIndex = after.indexOf("product-C");
      if (cIndex >= 0) {
        const cScore = Number(after[cIndex + 1]);
        expect(cScore).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
