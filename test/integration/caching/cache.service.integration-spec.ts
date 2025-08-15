import { Test, TestingModule } from "@nestjs/testing";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { CacheService } from "../../../src/common/infrastructure/cache/cache.service";
import { RedisManager } from "../../../src/common/infrastructure/config/redis.config";

describe("CacheService Integration Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let cacheService: CacheService;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [RedisManager, CacheService],
    }).compile();

    cacheService = moduleFixture.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    // Redis 캐시 클리어
    if (environment.redisHelper) {
      await environment.redisHelper.flushAll();
    }
  });

  describe("기본 캐시 작업", () => {
    it("데이터를 저장하고 조회할 수 있어야 함", async () => {
      // Given
      const key = "test:key";
      const value = { id: 1, name: "test", count: 42 };
      const ttl = 60; // 60초

      // When
      await cacheService.set(key, value, ttl);
      const result = await cacheService.get(key);

      // Then
      expect(result).toEqual(value);
    });

    it("존재하지 않는 키 조회 시 null을 반환해야 함", async () => {
      // When
      const result = await cacheService.get("nonexistent:key");

      // Then
      expect(result).toBeNull();
    });

    it("캐시를 삭제할 수 있어야 함", async () => {
      // Given
      const key = "test:delete";
      const value = { test: "data" };
      await cacheService.set(key, value, 60);

      // When
      await cacheService.del(key);
      const result = await cacheService.get(key);

      // Then
      expect(result).toBeNull();
    });

    it("여러 키-값을 동시에 저장할 수 있어야 함", async () => {
      // Given
      const entries = [
        { key: "multi:1", value: { id: 1 }, ttl: 60 },
        { key: "multi:2", value: { id: 2 }, ttl: 60 },
        { key: "multi:3", value: { id: 3 }, ttl: 60 },
      ];

      // When
      await cacheService.setMultiple(entries);

      // Then
      const results = await Promise.all([
        cacheService.get("multi:1"),
        cacheService.get("multi:2"),
        cacheService.get("multi:3"),
      ]);

      expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("키 존재 여부를 확인할 수 있어야 함", async () => {
      // Given
      const key = "test:exists";
      const value = { test: true };
      await cacheService.set(key, value, 60);

      // When & Then
      expect(await cacheService.exists(key)).toBe(true);
      expect(await cacheService.exists("nonexistent")).toBe(false);
    });
  });

  describe("TTL 동작", () => {
    it("TTL이 짧은 캐시는 만료되어야 함", async () => {
      // Given
      const key = "test:ttl";
      const value = { short: "lived" };
      const shortTtl = 1; // 1초

      // When
      await cacheService.set(key, value, shortTtl);

      // 즉시 조회하면 존재
      const immediateResult = await cacheService.get(key);
      expect(immediateResult).toEqual(value);

      // 2초 대기
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Then - 만료되어 null 반환
      const expiredResult = await cacheService.get(key);
      expect(expiredResult).toBeNull();
    }, 10000); // 10초 타임아웃
  });

  describe("에러 처리", () => {
    it("잘못된 JSON 데이터로 인한 에러는 graceful하게 처리되어야 함", async () => {
      // Redis에 직접 잘못된 JSON 저장
      const redisClient = (cacheService as any).redis;
      await redisClient.set("invalid:json", "{ invalid json }");

      // When & Then - 에러가 발생하지 않고 null 반환
      const result = await cacheService.get("invalid:json");
      expect(result).toBeNull();
    });
  });
});
