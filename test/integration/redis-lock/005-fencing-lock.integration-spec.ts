import { FencingLockService } from "../../../src/common/infrastructure/locks/fencing-lock.service";
import { BaseLockIntegrationTest } from "./000-base-lock-spec";
import { FencingTokenViolationError } from "../../../src/common/infrastructure/infrastructure.exceptions";

describe("펜싱 락 서비스 통합 테스트", () => {
  class FencingLockIntegrationTest extends BaseLockIntegrationTest {
    protected createLockService(): FencingLockService {
      return new FencingLockService(this.testRedisConfig);
    }

    protected getLockServiceClass(): any {
      return FencingLockService;
    }
  }

  let test: FencingLockIntegrationTest;

  beforeEach(async () => {
    test = new FencingLockIntegrationTest();
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

  describe("펜싱 토큰 기능", () => {
    it("락 실행 중에 펜싱 토큰을 제공해야 함", async () => {
      const lockKey = "test:fencing:token";
      const fencingService = test.lockService as FencingLockService;
      let capturedToken: number | null = null;

      await fencingService.withLock(lockKey, async (fencingToken) => {
        capturedToken = fencingToken;
        expect(capturedToken).toBeGreaterThan(0);
      });

      expect(capturedToken).toBeGreaterThan(0);
    });

    it("후속 획득에 대해 펜싱 토큰을 증가시켜야 함", async () => {
      const lockKey = "test:fencing:increment";
      const fencingService = test.lockService as FencingLockService;
      const tokens: number[] = [];

      // 첫 번째 획득
      await fencingService.withLock(lockKey, async (fencingToken) => {
        tokens.push(fencingToken);
      });

      // 두 번째 획득
      await fencingService.withLock(lockKey, async (fencingToken) => {
        tokens.push(fencingToken);
      });

      // 세 번째 획득
      await fencingService.withLock(lockKey, async (fencingToken) => {
        tokens.push(fencingToken);
      });

      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toBeGreaterThan(tokens[0]);
      expect(tokens[2]).toBeGreaterThan(tokens[1]);
    });

    it("펜싱 토큰을 올바르게 검증해야 함", async () => {
      const lockKey = "test:fencing:validate";
      const fencingService = test.lockService as FencingLockService;

      await fencingService.withLock(lockKey, async (fencingToken) => {
        expect(fencingToken).toBeGreaterThan(0);

        // 현재 토큰 검증 - 락 내부에서는 항상 유효해야 함 (예외가 발생하지 않아야 함)
        await expect(
          fencingService.validateFencingToken(lockKey, fencingToken)
        ).resolves.not.toThrow();

        // 잘못된 토큰 검증 - 예외가 발생해야 함
        await expect(
          fencingService.validateFencingToken(lockKey, fencingToken + 1000)
        ).rejects.toThrow(FencingTokenViolationError);
      });
    });

    it("순차적으로 실행되는 락들의 펜싱 토큰이 순서대로 증가해야 함", async () => {
      const lockKey = "test:fencing:sequential";
      const fencingService = test.lockService as FencingLockService;
      const capturedTokens: number[] = [];

      // 순차적으로 락 획득
      for (let i = 0; i < 3; i++) {
        await fencingService.withLock(lockKey, async (fencingToken) => {
          capturedTokens.push(fencingToken);
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
      }

      expect(capturedTokens).toHaveLength(3);
      // 토큰은 순차적으로 증가해야 함
      expect(capturedTokens[1]).toBeGreaterThan(capturedTokens[0]);
      expect(capturedTokens[2]).toBeGreaterThan(capturedTokens[1]);
    });

    it("동시 락 요청 시 펜싱 토큰 순서가 보장되어야 함", async () => {
      const lockKey = "test:fencing:concurrent";
      const fencingService = test.lockService as FencingLockService;
      const capturedTokens: number[] = [];

      // 동시에 여러 락 요청
      const promises = Array.from({ length: 3 }, () =>
        fencingService.withLock(lockKey, async (fencingToken) => {
          capturedTokens.push(fencingToken);
          await new Promise((resolve) => setTimeout(resolve, 50));
        })
      );

      await Promise.all(promises);

      expect(capturedTokens).toHaveLength(3);

      // 토큰들을 정렬하여 연속성 확인
      const sortedTokens = [...capturedTokens].sort((a, b) => a - b);
      expect(sortedTokens[1]).toBe(sortedTokens[0] + 1);
      expect(sortedTokens[2]).toBe(sortedTokens[1] + 1);
    }, 10000);

    it("락 외부에서 펜싱 토큰 검증이 실패해야 함", async () => {
      const lockKey = "test:fencing:outside-validation";
      const fencingService = test.lockService as FencingLockService;
      let capturedToken: number | null = null;

      // 락 내부에서 토큰 획득
      await fencingService.withLock(lockKey, async (fencingToken) => {
        capturedToken = fencingToken;
      });

      expect(capturedToken).toBeGreaterThan(0);

      // 락 외부에서 잘못된 토큰으로 검증 - 예외가 발생해야 함
      await expect(
        fencingService.validateFencingToken(lockKey, capturedToken! + 999)
      ).rejects.toThrow(FencingTokenViolationError);
    });

    it("펜싱 토큰 값의 TTL 만료 후 검증이 실패해야 함", async () => {
      const lockKey = "test:fencing:ttl-expiry";
      const fencingService = test.lockService as FencingLockService;
      let capturedToken: number | null = null;

      // 락 내부에서 토큰 획득
      await fencingService.withLock(lockKey, async (fencingToken) => {
        capturedToken = fencingToken;
      });

      expect(capturedToken).toBeGreaterThan(0);

      // fencing_value 키를 수동으로 삭제하여 TTL 만료 시뮬레이션
      const fencingValueKey = `${lockKey}:fencing_value`;
      await test.redisHelper.getClient().del(fencingValueKey);

      // 이제 검증이 실패해야 함 (fencing_value가 없으므로)
      await expect(
        fencingService.validateFencingToken(lockKey, capturedToken!)
      ).rejects.toThrow(FencingTokenViolationError);
    });

    it("에러 시에도 락이 정상적으로 해제되어야 함", async () => {
      const lockKey = "test:fencing:error-cleanup";
      const fencingService = test.lockService as FencingLockService;

      await expect(
        fencingService.withLock(lockKey, async (fencingToken) => {
          expect(fencingToken).toBeGreaterThan(0);
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      // 락이 해제되어 다시 획득할 수 있어야 함
      await fencingService.withLock(lockKey, async (fencingToken) => {
        expect(fencingToken).toBeGreaterThan(0);
      });
    });

    it("여러 독립적인 펜싱 락을 지원해야 함", async () => {
      const lockKey1 = "test:fencing:independent1";
      const lockKey2 = "test:fencing:independent2";
      const fencingService = test.lockService as FencingLockService;
      const results: Array<{ lock: string; token: number }> = [];

      const promise1 = fencingService.withLock(
        lockKey1,
        async (fencingToken) => {
          results.push({ lock: "lock1", token: fencingToken });
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      const promise2 = fencingService.withLock(
        lockKey2,
        async (fencingToken) => {
          results.push({ lock: "lock2", token: fencingToken });
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      await Promise.all([promise1, promise2]);

      expect(results).toHaveLength(2);
      expect(results.find((r) => r.lock === "lock1")).toBeDefined();
      expect(results.find((r) => r.lock === "lock2")).toBeDefined();

      // 독립적인 락들의 토큰은 별도로 관리되어야 함
      const lock1Token = results.find((r) => r.lock === "lock1")!.token;
      const lock2Token = results.find((r) => r.lock === "lock2")!.token;

      // 각각의 첫 번째 토큰이므로 1이어야 함
      expect(lock1Token).toBe(1);
      expect(lock2Token).toBe(1);
    }, 5000);

    it("펜싱 토큰 오버플로우를 우아하게 처리해야 함", async () => {
      const lockKey = "test:fencing:overflow";
      const fencingService = test.lockService as FencingLockService;

      // 높은 펜싱 토큰 값 설정
      const fencingKey = `${lockKey}:fencing`;
      await test.redisHelper.getClient().set(fencingKey, "999999999");

      await fencingService.withLock(lockKey, async (fencingToken) => {
        expect(fencingToken).toBeGreaterThan(999999999);
        expect(fencingToken).toBe(1000000000);
      });
    });

    it("펜싱 토큰 검증 예외 처리를 확인해야 함", async () => {
      const lockKey = "test:fencing:exception";
      const fencingService = test.lockService as FencingLockService;

      // 먼저 락을 획득하여 펜싱 토큰을 생성
      await fencingService.withLock(lockKey, async (fencingToken) => {
        expect(fencingToken).toBeGreaterThan(0);
      });

      // 락 외부에서 validateFencingToken 호출하면 예외 발생해야 함
      await expect(
        fencingService.validateFencingToken(lockKey, 999)
      ).rejects.toThrow(FencingTokenViolationError);
    });

    it("동일한 락에 대한 연속적인 토큰 생성을 확인해야 함", async () => {
      const lockKey = "test:fencing:continuous";
      const fencingService = test.lockService as FencingLockService;
      const tokens: number[] = [];

      // 5번 연속으로 락 획득
      for (let i = 0; i < 5; i++) {
        await fencingService.withLock(lockKey, async (fencingToken) => {
          tokens.push(fencingToken);
        });
      }

      expect(tokens).toHaveLength(5);

      // 모든 토큰이 연속적으로 증가해야 함
      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i]).toBe(tokens[i - 1] + 1);
      }
    });
  });
});
