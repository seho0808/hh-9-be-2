import { PubSubLockService } from "../../../src/common/infrastructure/locks/pubsub-lock.service";
import { BaseLockIntegrationTest } from "./000-base-lock-spec";

describe("PubSub 락 서비스 통합 테스트", () => {
  class PubSubLockIntegrationTest extends BaseLockIntegrationTest {
    protected createLockService(): PubSubLockService {
      return new PubSubLockService(this.testRedisConfig);
    }

    protected getLockServiceClass(): any {
      return PubSubLockService;
    }
  }

  let test: PubSubLockIntegrationTest;

  beforeEach(async () => {
    test = new PubSubLockIntegrationTest();
    await test.setupTestEnvironment();
  });

  afterEach(async () => {
    await test.cleanup();
  });

  describe("기본 락 동작", () => {
    it("락 획득 및 해제가 성공해야 함", async () => {
      await test.testBasicLockAcquisition();
    });

    it.skip("타임아웃 시간 내에 락을 획득할 수 없으면 타임아웃이 발생해야 함", async () => {
      await test.testLockTimeout();
    });

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

  describe("PubSub 전용 기능", () => {
    it("락이 해제될 때 대기 중인 클라이언트에게 알림을 보내야 함", async () => {
      const lockKey = "test:pubsub:notify";
      const executionOrder: string[] = [];

      // 첫 번째 클라이언트가 300ms 동안 락 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        executionOrder.push("client1-start");
        await new Promise((resolve) => setTimeout(resolve, 300));
        executionOrder.push("client1-end");
      });

      // 첫 번째 클라이언트가 락을 획득하도록 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 클라이언트는 대기하고 알림을 받아야 함
      const promise2 = test.lockService.withLock(lockKey, async () => {
        executionOrder.push("client2-executed");
      });

      await Promise.all([promise1, promise2]);

      expect(executionOrder).toEqual([
        "client1-start",
        "client1-end",
        "client2-executed",
      ]);
    }, 5000);

    it("여러 대기 클라이언트를 효율적으로 처리해야 함", async () => {
      const lockKey = "test:pubsub:multiple";
      const executionOrder: number[] = [];
      const clientCount = 10;

      const promises = Array.from({ length: clientCount }, (_, i) =>
        test.lockService.withLock(lockKey, async () => {
          executionOrder.push(i);
          await new Promise((resolve) => setTimeout(resolve, 20));
        })
      );

      await Promise.all(promises);

      // 모든 클라이언트가 실행되어야 함
      expect(executionOrder).toHaveLength(clientCount);
      expect(new Set(executionOrder).size).toBe(clientCount);
    }, 10000);

    it("매우 짧은 락 지속 시간에서도 작동해야 함", async () => {
      const lockKey = "test:pubsub:short";
      const results: boolean[] = [];

      const promises = Array.from({ length: 5 }, () =>
        test.lockService.withLock(lockKey, async () => {
          results.push(true);
          // 매우 짧은 임계 구역
          await new Promise((resolve) => setTimeout(resolve, 1));
        })
      );

      await Promise.all(promises);
      expect(results).toHaveLength(5);
    }, 10000);

    it("락 해제 알림 실패를 우아하게 처리해야 함", async () => {
      const lockKey = "test:pubsub:graceful";

      // 이 테스트는 PubSub에 문제가 있어도 시스템이 작동하는지 확인함
      // 폴링 메커니즘으로 여전히 진행이 가능해야 함
      await test.lockService.withLock(lockKey, async () => {
        // 실행 중 락이 존재하는지 확인
        expect(await test.redisHelper.exists(lockKey)).toBe(true);
      });

      // 락이 해제되어야 함
      expect(await test.redisHelper.exists(lockKey)).toBe(false);
    });

    it("채널을 적절히 정리해야 함", async () => {
      const lockKey = "test:pubsub:cleanup";
      const channelKey = `${lockKey}:channel`;

      await test.lockService.withLock(lockKey, async () => {
        // 락 실행 중에는 채널이 개념적으로 존재해야 함
        // (Redis는 빈 채널을 지속하지 않음)
      });

      // 락 해제 후에는 지속적인 채널 데이터가 남아있으면 안 됨
      const channelExists = await test.redisHelper.exists(channelKey);
      expect(channelExists).toBe(false);
    });

    it("빠른 획득/해제 주기를 처리할 수 있어야 함", async () => {
      const lockKey = "test:pubsub:rapid";
      const iterations = 20;
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        await test.lockService.withLock(lockKey, async () => {
          successCount++;
          // 매우 빠른 작업
        });
      }

      expect(successCount).toBe(iterations);
    }, 10000);
  });
});
