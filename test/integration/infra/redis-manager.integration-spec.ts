import { RedisManager } from "../../../src/common/infrastructure/config/redis.config";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";

describe("RedisManager 통합 테스트 (EVALSHA)", () => {
  let redisManager: RedisManager;
  let testEnvironment: TestEnvironment;
  const factory = new TestEnvironmentFactory();

  beforeAll(async () => {
    testEnvironment = await factory.createRedisOnlyEnvironment();
    redisManager = new RedisManager();
  });

  afterAll(async () => {
    await redisManager.disconnect();
    await factory.cleanup(testEnvironment);
  });

  beforeEach(async () => {
    // Redis 초기화
    const redis = redisManager.getClient();
    await redis.flushall();
    redisManager.clearScriptCache();
  });

  describe("EVALSHA 기본 동작", () => {
    it("간단한 Lua 스크립트를 EVALSHA로 실행한다", async () => {
      // Given
      const script = `
        local key = KEYS[1]
        local value = ARGV[1]
        redis.call('SET', key, value)
        return redis.call('GET', key)
      `;
      const key = "test:key";
      const value = "test:value";

      // When
      const result = await redisManager.evalsha(script, 1, key, value);

      // Then
      expect(result).toBe(value);

      // Redis에서 직접 확인
      const redis = redisManager.getClient();
      const storedValue = await redis.get(key);
      expect(storedValue).toBe(value);
    });

    it("동일한 스크립트를 여러 번 실행해도 정상 동작한다 (캐싱 테스트)", async () => {
      // Given
      const script = `
        local counter = KEYS[1]
        return redis.call('INCR', counter)
      `;
      const counterKey = "test:counter";

      // When - 3번 실행
      const result1 = await redisManager.evalsha(script, 1, counterKey);
      const result2 = await redisManager.evalsha(script, 1, counterKey);
      const result3 = await redisManager.evalsha(script, 1, counterKey);

      // Then
      expect(result1).toBe(1);
      expect(result2).toBe(2);
      expect(result3).toBe(3);
    });
  });

  describe("복잡한 스크립트 처리", () => {
    it("배열을 반환하는 스크립트를 정상 처리한다", async () => {
      // Given
      const arrayScript = `
        local key1 = KEYS[1]
        local key2 = KEYS[2]
        local value = ARGV[1]
        
        redis.call('SET', key1, value)
        redis.call('SET', key2, tonumber(value) * 2)
        
        return {
          redis.call('GET', key1),
          redis.call('GET', key2),
          'success'
        }
      `;

      const key1 = "test:array:1";
      const key2 = "test:array:2";
      const value = "10";

      // When
      const result = (await redisManager.evalsha(
        arrayScript,
        2,
        key1,
        key2,
        value
      )) as string[];

      // Then
      expect(result).toEqual(["10", "20", "success"]);
    });

    it("조건부 로직을 포함한 스크립트를 정상 처리한다", async () => {
      // Given
      const conditionalScript = `
        local key = KEYS[1]
        local threshold = tonumber(ARGV[1])
        local increment = tonumber(ARGV[2])
        
        local current = tonumber(redis.call('GET', key) or 0)
        
        if current >= threshold then
          return {0, current, 'exceeded'}
        else
          local newValue = redis.call('INCRBY', key, increment)
          return {1, newValue, 'success'}
        end
      `;

      const key = "test:conditional";
      const threshold = 50;
      const increment = 10;

      // When - 첫 번째 실행 (성공)
      const result1 = (await redisManager.evalsha(
        conditionalScript,
        1,
        key,
        threshold.toString(),
        increment.toString()
      )) as [number, number, string];

      const result2 = (await redisManager.evalsha(
        conditionalScript,
        1,
        key,
        threshold.toString(),
        increment.toString()
      )) as [number, number, string];

      // Then
      expect(result1).toEqual([1, 10, "success"]);
      expect(result2).toEqual([1, 20, "success"]);
    });
  });

  describe("NOSCRIPT 에러 처리", () => {
    it("스크립트가 Redis에 없을 때 자동으로 로드하고 재시도한다", async () => {
      // Given
      const script = `
        local key = KEYS[1]
        return redis.call('INCR', key)
      `;
      const key = "test:noscript";

      // Redis에서 모든 스크립트 삭제
      const redis = redisManager.getClient();
      await redis.script("FLUSH");

      // When - 스크립트가 없는 상태에서 실행
      const result = await redisManager.evalsha(script, 1, key);

      // Then
      expect(result).toBe(1);

      // 두 번째 실행도 정상 동작해야 함
      const result2 = await redisManager.evalsha(script, 1, key);
      expect(result2).toBe(2);
    });
  });

  describe("스크립트 캐시 관리", () => {
    it("스크립트 캐시를 정리할 수 있다", async () => {
      // Given
      const script = `return "test"`;

      // 스크립트 실행하여 캐시에 저장
      await redisManager.evalsha(script, 0);

      // When
      redisManager.clearScriptCache();

      // 캐시가 정리된 후에도 정상 동작해야 함 (재로드됨)
      const result = await redisManager.evalsha(script, 0);

      // Then
      expect(result).toBe("test");
    });
  });
});
