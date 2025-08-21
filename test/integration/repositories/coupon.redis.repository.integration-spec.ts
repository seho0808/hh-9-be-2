import { Test, TestingModule } from "@nestjs/testing";
import { CouponRedisRepository } from "@/coupon/infrastructure/persistence/coupon-redis.repository";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { RedisManager } from "@/common/infrastructure/config/redis.config";
import { TestRedisConfig } from "../../test-environment/mocks/redis.config";
import { v4 as uuidv4 } from "uuid";

describe("CouponRedisRepository 통합 테스트 (Redis)", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let redisManager: RedisManager;
  let repository: CouponRedisRepository;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createRedisOnlyEnvironment();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RedisManager,
          useValue: new TestRedisConfig(environment.redisContainer!),
        },
        CouponRedisRepository,
      ],
    }).compile();

    redisManager = moduleFixture.get<RedisManager>(RedisManager);
    repository = moduleFixture.get<CouponRedisRepository>(
      CouponRedisRepository
    );
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.redisHelper.flushAll();
  });

  describe("checkAndDecrementRemainingCount (countdown 방식)", () => {
    it("발급 가능한 경우 카운터를 원자적으로 감소시킨다", async () => {
      // Given
      const couponId = uuidv4();
      const totalCount = 100;

      // When
      const result = await repository.checkAndDecrementRemainingCount(
        couponId,
        totalCount
      );

      // Then
      expect(result.success).toBe(true);
      expect(result.issuedCount).toBe(1);
      expect(result.remainingCount).toBe(99);

      // Redis에서 실제 값 확인
      const remainingCount = await repository.getRemainingCount(couponId);
      expect(remainingCount).toBe(99);
    });

    it("발급 수량이 초과된 경우 실패한다", async () => {
      // Given
      const couponId = uuidv4();
      const totalCount = 2;

      // 2개 발급
      await repository.checkAndDecrementRemainingCount(couponId, totalCount);
      await repository.checkAndDecrementRemainingCount(couponId, totalCount);

      // When
      const result = await repository.checkAndDecrementRemainingCount(
        couponId,
        totalCount
      );

      // Then
      expect(result.success).toBe(false);
      expect(result.issuedCount).toBe(2);
      expect(result.remainingCount).toBe(0);
    });

    it("첫 번째 요청 시 자동으로 totalCount로 초기화된다", async () => {
      // Given
      const couponId = uuidv4();
      const totalCount = 50;

      // Redis에 키가 없는 상태 확인
      const redis = redisManager.getClient();
      const keyExists = await redis.exists(
        `coupon:remaining_count:${couponId}`
      );
      expect(keyExists).toBe(0);

      // When
      const result = await repository.checkAndDecrementRemainingCount(
        couponId,
        totalCount
      );

      // Then
      expect(result.success).toBe(true);
      expect(result.issuedCount).toBe(1);
      expect(result.remainingCount).toBe(49);

      // 키가 생성되었고 TTL이 설정되었는지 확인
      const keyExistsAfter = await redis.exists(
        `coupon:remaining_count:${couponId}`
      );
      const ttl = await redis.ttl(`coupon:remaining_count:${couponId}`);
      expect(keyExistsAfter).toBe(1);
      expect(ttl).toBeGreaterThan(0);
    });

    it("동시 발급 시 정확한 수량만 발급된다", async () => {
      // Given
      const couponId = uuidv4();
      const totalCount = 10;
      const concurrentRequests = 20;

      // When
      const promises = Array.from({ length: concurrentRequests }, () =>
        repository.checkAndDecrementRemainingCount(couponId, totalCount)
      );

      const results = await Promise.all(promises);

      // Then
      const successfulIssues = results.filter((r) => r.success);
      const failedIssues = results.filter((r) => !r.success);

      expect(successfulIssues.length).toBe(totalCount);
      expect(failedIssues.length).toBe(concurrentRequests - totalCount);

      const finalRemainingCount = await repository.getRemainingCount(couponId);
      expect(finalRemainingCount).toBe(0);
    });
  });

  describe("rollbackRemainingCount", () => {
    it("발급 실패 시 카운터를 롤백한다", async () => {
      // Given
      const couponId = uuidv4();
      const totalCount = 100;

      await repository.checkAndDecrementRemainingCount(couponId, totalCount);
      const beforeRollbackRemaining =
        await repository.getRemainingCount(couponId);
      expect(beforeRollbackRemaining).toBe(99);

      // When
      await repository.rollbackRemainingCount(couponId);

      // Then
      const afterRollbackRemaining =
        await repository.getRemainingCount(couponId);
      expect(afterRollbackRemaining).toBe(100);
    });

    it("키가 존재하지 않으면 롤백하지 않는다", async () => {
      // Given
      const couponId = uuidv4();

      // When & Then - 에러 없이 실행되어야 함
      await expect(
        repository.rollbackRemainingCount(couponId)
      ).resolves.not.toThrow();

      // 여전히 키가 없어야 함
      const remainingCount = await repository.getRemainingCount(couponId);
      expect(remainingCount).toBe(0);
    });
  });

  describe("초기화 및 관리 메서드", () => {
    it("initializeRemainingCount로 수동 초기화가 가능하다", async () => {
      // Given
      const couponId = uuidv4();
      const totalCount = 50;

      // When
      await repository.initializeRemainingCount(couponId, totalCount);

      // Then
      const remainingCount = await repository.getRemainingCount(couponId);
      expect(remainingCount).toBe(totalCount);

      // TTL 확인
      const redis = redisManager.getClient();
      const ttl = await redis.ttl(`coupon:remaining_count:${couponId}`);
      expect(ttl).toBeGreaterThan(0);
    });

    it("deleteRemainingCount로 카운터를 삭제할 수 있다", async () => {
      // Given
      const couponId = uuidv4();
      await repository.initializeRemainingCount(couponId, 100);

      const redis = redisManager.getClient();
      const beforeDelete = await redis.exists(
        `coupon:remaining_count:${couponId}`
      );
      expect(beforeDelete).toBe(1);

      // When
      await repository.deleteRemainingCount(couponId);

      // Then
      const afterDelete = await redis.exists(
        `coupon:remaining_count:${couponId}`
      );
      expect(afterDelete).toBe(0);

      const remainingCount = await repository.getRemainingCount(couponId);
      expect(remainingCount).toBe(0);
    });
  });

  describe("Redis 키 관리", () => {
    it("올바른 Redis 키 형식을 사용한다", async () => {
      // Given
      const couponId = "test-coupon-123";
      const expectedKey = `coupon:remaining_count:${couponId}`;

      // When
      await repository.initializeRemainingCount(couponId, 100);

      // Then
      const redis = redisManager.getClient();
      const keyExists = await redis.exists(expectedKey);
      expect(keyExists).toBe(1);

      const value = await redis.get(expectedKey);
      expect(value).toBe("100");
    });
  });
});
