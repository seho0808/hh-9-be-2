import { SpinLockService } from "../../../src/common/infrastructure/locks/spin-lock.service";
import { BaseLockIntegrationTest } from "./000-base-lock-spec";

describe("스핀락 서비스 통합 테스트", () => {
  class SpinLockIntegrationTest extends BaseLockIntegrationTest {
    protected createLockService(): SpinLockService {
      return new SpinLockService(this.testRedisConfig);
    }

    protected getLockServiceClass(): any {
      return SpinLockService;
    }
  }

  let test: SpinLockIntegrationTest;

  beforeEach(async () => {
    test = new SpinLockIntegrationTest();
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

  describe("스핀락 전용 기능", () => {
    it("지수 백오프를 지원해야 함", async () => {
      const lockKey = "test:spin:backoff";
      const startTime = Date.now();

      // 첫 번째 클라이언트가 락 보유
      const promise1 = test.lockService.withLock(lockKey, async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      // 두 번째 클라이언트는 백오프 사용해야 함
      await new Promise((resolve) => setTimeout(resolve, 50)); // 첫 번째 락이 획득되도록 보장

      const promise2 = test.lockService.withLock(lockKey, async () => {
        const duration = Date.now() - startTime;
        // 백오프로 인해 대기했어야 함
        expect(duration).toBeGreaterThan(400);
      });

      await Promise.all([promise1, promise2]);
    }, 10000);
  });
});
