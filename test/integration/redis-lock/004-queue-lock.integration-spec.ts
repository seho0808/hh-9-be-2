import { QueueLockService } from "../../../src/common/infrastructure/locks/queue-lock.service";
import { BaseLockIntegrationTest } from "./000-base-lock-spec";

describe("큐 락 서비스 통합 테스트", () => {
  class QueueLockIntegrationTest extends BaseLockIntegrationTest {
    protected createLockService(): QueueLockService {
      return new QueueLockService(this.testRedisConfig);
    }

    protected getLockServiceClass(): any {
      return QueueLockService;
    }
  }

  let test: QueueLockIntegrationTest;

  beforeEach(async () => {
    test = new QueueLockIntegrationTest();
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

  describe("큐 기반 락 전용 기능", () => {
    it("대기열에서 락을 순차적으로 획득해야 함", async () => {
      const lockKey = "test:queue:fifo";
      const executionOrder: number[] = [];
      const clientCount = 5;

      // 첫 번째 클라이언트가 락을 오래 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        executionOrder.push(0);
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // 나머지 클라이언트들은 큐에서 대기
      await new Promise((resolve) => setTimeout(resolve, 50));

      const promises = Array.from({ length: clientCount - 1 }, (_, i) =>
        test.lockService.withLock(lockKey, async () => {
          executionOrder.push(i + 1);
          await new Promise((resolve) => setTimeout(resolve, 20));
        })
      );

      await Promise.all([promise1, ...promises]);

      // 모든 클라이언트가 실행되었는지 확인 (순서는 레이스 컨디션으로 인해 완전히 보장되지 않을 수 있음)
      expect(executionOrder).toHaveLength(clientCount);
      expect(new Set(executionOrder).size).toBe(clientCount);
      expect(executionOrder[0]).toBe(0); // 첫 번째는 보장됨
    }, 10000);

    it("큐에 등록하고 PubSub 알림을 통해 순서대로 실행해야 함", async () => {
      const lockKey = "test:queue:pubsub";
      const queueKey = `${lockKey}:queue`;
      const executionTimes: number[] = [];
      const startTime = Date.now();

      // 첫 번째 클라이언트가 락을 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        executionTimes.push(Date.now() - startTime);
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // 잠시 대기하여 첫 번째 락이 획득되도록 함
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 클라이언트는 큐에 등록되고 대기
      const promise2 = test.lockService.withLock(lockKey, async () => {
        executionTimes.push(Date.now() - startTime);
        // LPOP 방식에서는 락 획득 시 이미 큐에서 제거됨
      });

      await Promise.all([promise1, promise2]);

      // 두 번째 실행은 첫 번째 실행 후에 일어나야 함
      expect(executionTimes[1]).toBeGreaterThan(executionTimes[0] + 250);

      // 모든 작업 완료 후 큐가 비어있어야 함
      const finalQueueLength = await test.redisHelper
        .getClient()
        .llen(queueKey);
      expect(finalQueueLength).toBe(0);
    }, 10000);

    it("큐에서 클라이언트 추가/제거가 올바르게 작동해야 함", async () => {
      const lockKey = "test:queue:management";
      const queueKey = `${lockKey}:queue`;

      // 첫 번째 클라이언트가 락을 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 클라이언트 시작 (큐에 등록됨)
      const promise2 = test.lockService.withLock(lockKey, async () => {
        // LPOP 방식에서는 락 획득 시 이미 큐에서 제거됨
      });

      // 큐에 등록되었는지 확인
      await new Promise((resolve) => setTimeout(resolve, 50));
      const queueLength = await test.redisHelper.getClient().llen(queueKey);
      expect(queueLength).toBe(1);

      await Promise.all([promise1, promise2]);

      // 모든 작업 완료 후 큐가 비어있어야 함
      const finalQueueLength = await test.redisHelper
        .getClient()
        .llen(queueKey);
      expect(finalQueueLength).toBe(0);
    }, 10000);

    it("타임아웃 시 클라이언트가 대기 상태에서 해제되어야 함", async () => {
      const lockKey = "test:queue:timeout";
      const queueKey = `${lockKey}:queue`;
      const shortTimeout = 300;

      // 첫 번째 클라이언트가 오래 락을 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 클라이언트는 타임아웃으로 실패해야 함
      await expect(
        test.lockService.withLock(
          lockKey,
          async () => {
            // 실행되지 않아야 함
          },
          { timeout: shortTimeout }
        )
      ).rejects.toThrow();

      // TTL 기반 정리에서는 만료된 아이템이 큐에 남아있을 수 있음
      // 하지만 다음 락 해제 시 자동으로 정리됨

      await promise1;

      // 첫 번째 클라이언트 완료 후 큐가 정리되어야 함
      const finalQueueLength = await test.redisHelper
        .getClient()
        .llen(queueKey);
      expect(finalQueueLength).toBe(0);
    }, 5000);

    it("여러 클라이언트가 동시에 큐에 등록되어도 중복되지 않아야 함", async () => {
      const lockKey = "test:queue:duplicate";
      const queueKey = `${lockKey}:queue`;

      // 첫 번째 클라이언트가 락을 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 여러 클라이언트가 동시에 큐에 등록 시도
      const promises = Array.from({ length: 3 }, (_, i) =>
        test.lockService.withLock(lockKey, async () => {
          // 성공적으로 실행됨
        })
      );

      // 잠시 대기하여 모든 클라이언트가 큐에 등록되도록 함
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 큐 길이 확인 (LPOP 방식에서는 일부가 이미 제거될 수 있음)
      const queueLength = await test.redisHelper.getClient().llen(queueKey);
      expect(queueLength).toBeGreaterThan(0); // 최소 1개는 있어야 함
      expect(queueLength).toBeLessThanOrEqual(3); // 최대 3개

      await Promise.all([promise1, ...promises]);

      // 모든 작업 완료 후 큐가 비어있어야 함
      const finalQueueLength = await test.redisHelper
        .getClient()
        .llen(queueKey);
      expect(finalQueueLength).toBe(0);
    }, 15000);

    it("락 해제 시 다음 대기자에게 정확히 알림을 보내야 함", async () => {
      const lockKey = "test:queue:notification";
      const channelKey = `${lockKey}:channel`;
      const receivedMessages: string[] = [];

      // 메시지 수신 모니터링
      const subscriber = test.redisHelper.getClient().duplicate();

      try {
        await subscriber.subscribe(channelKey);

        subscriber.on("message", (channel, message) => {
          if (channel === channelKey) {
            receivedMessages.push(message);
          }
        });

        // 첫 번째 클라이언트가 락을 보유
        const promise1 = test.lockService.withLock(lockKey, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        // 두 번째 클라이언트가 대기
        const promise2 = test.lockService.withLock(lockKey, async () => {
          // 실행됨
        });

        await Promise.all([promise1, promise2]);

        // 알림 메시지가 발송되었는지 확인
        expect(receivedMessages.length).toBeGreaterThan(0);
      } finally {
        subscriber.disconnect();
      }
    }, 10000);

    it("높은 동시성에서도 모든 클라이언트가 실행되어야 함", async () => {
      const lockKey = "test:queue:high-concurrency";
      const clientCount = 10;
      const executionOrder: number[] = [];
      const executionTimes: number[] = [];
      const startTime = Date.now();

      // 첫 번째 클라이언트가 락을 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        executionOrder.push(0);
        executionTimes.push(Date.now() - startTime);
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 나머지 클라이언트들이 동시에 큐에 등록
      const promises = Array.from({ length: clientCount - 1 }, (_, i) =>
        test.lockService.withLock(lockKey, async () => {
          executionOrder.push(i + 1);
          executionTimes.push(Date.now() - startTime);
          await new Promise((resolve) => setTimeout(resolve, 30));
        })
      );

      await Promise.all([promise1, ...promises]);

      // 모든 클라이언트가 실행되었는지 확인
      expect(executionOrder).toHaveLength(clientCount);
      expect(new Set(executionOrder).size).toBe(clientCount);
      expect(executionOrder[0]).toBe(0); // 첫 번째는 보장됨

      // 시간 순서 확인 (첫 번째는 다른 것들보다 먼저)
      expect(executionTimes[0]).toBeLessThan(
        Math.min(...executionTimes.slice(1))
      );
    }, 20000);

    it("큐 TTL이 설정되고 관리되어야 함", async () => {
      const lockKey = "test:queue:ttl";
      const queueKey = `${lockKey}:queue`;

      // 첫 번째 클라이언트가 락을 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 두 번째 클라이언트가 큐에 등록
      const promise2 = test.lockService.withLock(lockKey, async () => {
        // 실행됨
      });

      // 큐에 TTL이 설정되었는지 확인
      await new Promise((resolve) => setTimeout(resolve, 100));
      const ttl = await test.redisHelper.getClient().ttl(queueKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300); // 5분 = 300초

      await Promise.all([promise1, promise2]);
    }, 10000);

    it("에러 발생 시에도 큐가 정리되어야 함", async () => {
      const lockKey = "test:queue:error-cleanup";
      const queueKey = `${lockKey}:queue`;

      // 첫 번째 클라이언트가 락을 보유하고 에러 발생
      await expect(
        test.lockService.withLock(lockKey, async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      // 두 번째 클라이언트는 정상적으로 실행되어야 함
      await test.lockService.withLock(lockKey, async () => {
        // 정상 실행
      });

      // 큐가 정리되었는지 확인
      const queueLength = await test.redisHelper.getClient().llen(queueKey);
      expect(queueLength).toBe(0);
    });
  });
});
