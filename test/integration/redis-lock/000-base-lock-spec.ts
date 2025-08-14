import { Test, TestingModule } from "@nestjs/testing";
import { StartedRedisContainer } from "@testcontainers/redis";
import { LockService } from "../../../src/common/infrastructure/locks/lock.interfaces";
import { TestEnvironmentFactory } from "../../test-environment/test-environment.factory";
import { TestRedisConfig } from "../../test-environment/mocks/redis.config";
import { RedisHelper } from "../../test-environment/helpers/redis-helper";

export abstract class BaseLockIntegrationTest {
  public testEnvironmentFactory = new TestEnvironmentFactory();
  public redisContainer: StartedRedisContainer;
  public lockService: LockService;
  public redisHelper: RedisHelper;
  public testRedisConfig: TestRedisConfig;
  public module: TestingModule;

  protected abstract createLockService(): LockService;
  protected abstract getLockServiceClass(): any;

  async setupTestEnvironment(): Promise<void> {
    const environment =
      await this.testEnvironmentFactory.createRedisOnlyEnvironment();
    this.redisContainer = environment.redisContainer!;

    this.testRedisConfig = new TestRedisConfig(this.redisContainer);
    this.redisHelper = new RedisHelper(this.redisContainer);

    // Redis 연결 확인
    const isConnected = await this.redisHelper.verifyConnection();
    if (!isConnected) {
      throw new Error("Redis container connection failed");
    }

    this.module = await Test.createTestingModule({
      providers: [
        {
          provide: "RedisConfig",
          useValue: this.testRedisConfig,
        },
        {
          provide: this.getLockServiceClass(),
          useFactory: () => this.createLockService(),
        },
      ],
    }).compile();

    this.lockService = this.module.get(this.getLockServiceClass());
  }

  async cleanup(): Promise<void> {
    await this.redisHelper?.flushAll();
    await this.redisHelper?.disconnect();
    await this.testRedisConfig?.disconnect();
    await this.module?.close();
    await this.redisContainer?.stop();
  }

  // 공통 테스트 시나리오
  async testBasicLockAcquisition(): Promise<void> {
    const lockKey = "test:lock:basic";
    let executed = false;

    await this.lockService.withLock(lockKey, async () => {
      executed = true;
      expect(await this.redisHelper.exists(lockKey)).toBe(true);
    });

    expect(executed).toBe(true);
    expect(await this.redisHelper.exists(lockKey)).toBe(false);
  }

  async testLockTimeout(): Promise<void> {
    const lockKey = "test:lock:timeout";
    const shortTimeout = 100;

    await expect(
      this.lockService.withLock(
        lockKey,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        },
        { timeout: shortTimeout }
      )
    ).rejects.toThrow();
  }

  async testConcurrentLockAccess(): Promise<void> {
    const lockKey = "test:lock:concurrent";
    const executionOrder: number[] = [];
    const concurrency = 5;

    const promises = Array.from({ length: concurrency }, (_, i) =>
      this.lockService.withLock(lockKey, async () => {
        executionOrder.push(i);
        await new Promise((resolve) => setTimeout(resolve, 50));
      })
    );

    await Promise.all(promises);

    // 모든 작업이 실행되어야 함
    expect(executionOrder).toHaveLength(concurrency);
    // 순서는 다를 수 있지만 모두 고유해야 함
    expect(new Set(executionOrder).size).toBe(concurrency);
  }

  async testLockReleasedOnError(): Promise<void> {
    const lockKey = "test:lock:error";

    await expect(
      this.lockService.withLock(lockKey, async () => {
        expect(await this.redisHelper.exists(lockKey)).toBe(true);
        throw new Error("Test error");
      })
    ).rejects.toThrow("Test error");

    // 에러 발생 후에도 락이 해제되어야 함
    expect(await this.redisHelper.exists(lockKey)).toBe(false);
  }

  async testLockTTLExpiration(): Promise<void> {
    const lockKey = "test:lock:ttl";
    const shortTtl = 600;

    await this.lockService.withLock(
      lockKey,
      async () => {
        expect(await this.redisHelper.exists(lockKey)).toBe(true);

        // TTL 만료까지 대기
        await new Promise((resolve) => setTimeout(resolve, shortTtl + 50));

        // 임계 구역 내에서는 락이 여전히 존재해야 함
        // (구현에 따라 다를 수 있음 - 일부는 TTL을 갱신할 수 있음)
      },
      { ttl: shortTtl }
    );

    // 함수 완료 후 락이 해제되어야 함
    expect(await this.redisHelper.exists(lockKey)).toBe(false);
  }
}
