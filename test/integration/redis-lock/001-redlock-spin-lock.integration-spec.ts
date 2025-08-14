import { RedlockSpinLockService } from "../../../src/common/infrastructure/locks/redlock-spin-lock.service";
import { BaseLockIntegrationTest } from "./000-base-lock-spec";

describe("Redlock 스핀락 서비스 통합 테스트", () => {
  class RedlockSpinLockIntegrationTest extends BaseLockIntegrationTest {
    protected createLockService(): RedlockSpinLockService {
      return new RedlockSpinLockService(this.testRedisConfig);
    }

    protected getLockServiceClass(): any {
      return RedlockSpinLockService;
    }
  }

  let test: RedlockSpinLockIntegrationTest;

  beforeEach(async () => {
    test = new RedlockSpinLockIntegrationTest();
    await test.setupTestEnvironment();
  });

  afterEach(async () => {
    await test.cleanup();
  });

  describe("기본 락 동작", () => {
    it("락 획득 및 해제가 성공해야 함", async () => {
      await test.testBasicLockAcquisition();
    });

    it("타임아웃 시간 내에 락을 획득할 수 없으면 타임아웃이 발생해야 함", async () => {
      // 참고: Redlock은 타임아웃을 다르게 처리하며, retryCount를 사용함
      const lockKey = "test:redlock:timeout";

      // 오래 실행되는 락 시작
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      // 첫 번째 락이 획득되도록 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 락은 재시도 횟수 초과로 인해 실패해야 함
      await expect(
        test.lockService.withLock(lockKey, async () => {
          // 실행되지 않아야 함
        })
      ).rejects.toThrow();

      await promise1;
    }, 5000);

    it("동시 락 접근을 처리할 수 있어야 함", async () => {
      await test.testConcurrentLockAccess();
    }, 10000);

    it("함수에서 에러가 발생해도 락이 해제되어야 함", async () => {
      await test.testLockReleasedOnError();
    });

    it("TTL 설정을 준수해야 함", async () => {
      await test.testLockTTLExpiration();
    });
  });

  describe("Redlock 전용 기능", () => {
    it("분산 락을 위해 Redlock 알고리즘을 사용해야 함", async () => {
      const lockKey = "test:redlock:algorithm";
      let lockAcquired = false;

      await test.lockService.withLock(lockKey, async () => {
        lockAcquired = true;
        // Redlock이 특정 패턴으로 락을 생성하는지 확인
        const keys = await test.redisHelper.getKeys("*");
        const lockExists = keys.some((key) => key.includes(lockKey));
        expect(lockExists).toBe(true);
      });

      expect(lockAcquired).toBe(true);
    });

    it("재시도 메커니즘을 적절히 처리해야 함", async () => {
      const lockKey = "test:redlock:retry";
      const startTime = Date.now();

      // 첫 번째 클라이언트가 짧게 락 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // 첫 번째 락이 획득되도록 짧은 지연
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 클라이언트는 재시도하여 결국 성공해야 함
      const promise2 = test.lockService.withLock(lockKey, async () => {
        const duration = Date.now() - startTime;
        // 첫 번째 락의 지속 시간 이상이 걸렸어야 함
        expect(duration).toBeGreaterThan(150);
      });

      await Promise.all([promise1, promise2]);
    }, 5000);

    it("사용자 정의 TTL 값과 함께 작동해야 함", async () => {
      const lockKey = "test:redlock:custom-ttl";
      const customTtl = 2000; // 2초

      await test.lockService.withLock(
        lockKey,
        async () => {
          // 락이 적절한 TTL로 존재해야 함
          const keys = await test.redisHelper.getKeys("*");
          const lockKey_found = keys.find((key) => key.includes(lockKey));

          if (lockKey_found) {
            const ttl = await test.redisHelper.ttl(lockKey_found);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(customTtl / 1000);
          }
        },
        { ttl: customTtl }
      );
    });

    it("락 연장 시나리오를 처리해야 함", async () => {
      const lockKey = "test:redlock:extension";

      await test.lockService.withLock(lockKey, async () => {
        // 실행 중에는 락이 유효해야 함
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 락이 여전히 존재해야 함
        const keys = await test.redisHelper.getKeys("*");
        const lockExists = keys.some((key) => key.includes(lockKey));
        expect(lockExists).toBe(true);
      });
    });

    it("높은 동시성 시나리오를 지원해야 함", async () => {
      const lockKey = "test:redlock:high-concurrency";
      const clientCount = 15;
      const executionOrder: number[] = [];

      const promises = Array.from({ length: clientCount }, (_, i) =>
        test.lockService
          .withLock(lockKey, async () => {
            executionOrder.push(i);
            await new Promise((resolve) => setTimeout(resolve, 20));
          })
          .catch((error) => {
            console.error(error);
          })
      );

      await Promise.all(promises);

      // 모든 클라이언트가 정확히 한 번씩 실행되어야 함
      expect(executionOrder).toHaveLength(clientCount);
      expect(new Set(executionOrder).size).toBe(clientCount);
    }, 15000);

    it("완료 시 락을 적절히 정리해야 함", async () => {
      const lockKey = "test:redlock:cleanup";

      await test.lockService.withLock(lockKey, async () => {
        // 실행 중에는 락이 존재해야 함
        const keys = await test.redisHelper.getKeys("*");
        const lockExists = keys.some((key) => key.includes(lockKey));
        expect(lockExists).toBe(true);
      });

      // 완료 후 락이 정리되어야 함
      const keysAfter = await test.redisHelper.getKeys("*");
      const lockExistsAfter = keysAfter.some((key) => key.includes(lockKey));
      expect(lockExistsAfter).toBe(false);
    });

    it("락 획득의 빠른 연속을 처리해야 함", async () => {
      const lockKey = "test:redlock:rapid";
      const iterations = 10;
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        await test.lockService
          .withLock(lockKey, async () => {
            successCount++;
            // 빠른 작업
            await new Promise((resolve) => setTimeout(resolve, 10));
          })
          .catch((error) => {
            console.error(error);
          });
      }

      expect(successCount).toBe(iterations);
    }, 5000);

    it("부하 상황에서 락 무결성을 유지해야 함", async () => {
      const lockKey = "test:redlock:integrity";
      let activeCount = 0;
      let maxActiveCount = 0;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          test.lockService
            .withLock(lockKey, async () => {
              activeCount++;
              maxActiveCount = Math.max(maxActiveCount, activeCount);

              await new Promise((resolve) => setTimeout(resolve, 50));

              activeCount--;
            })
            .catch((error) => {
              console.error(error);
            })
        );
      }

      await Promise.all(promises);

      // 어떤 시점에도 한 클라이언트만 활성상태여야 함
      expect(maxActiveCount).toBe(1);
    }, 10000);
  });
});
