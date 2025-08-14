import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../../test-environment/test-environment.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponStatus,
  UserCouponTypeOrmEntity,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";

// UseCase imports
import { IssueUserCouponWithSpinLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-spin-lock.use-case";
import { IssueUserCouponWithPubSubLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-pubsub-lock.use-case";
import { IssueUserCouponWithFencingLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-fencing-lock.use-case";
import { IssueUserCouponWithQueueLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-queue-lock.use-case";
import { IssueUserCouponWithRedlockSpinLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-redlock-spin-lock.use-case";

// Service imports
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { RedisManager } from "@/common/infrastructure/config/redis.config";

// Lock service imports
import { SpinLockService } from "@/common/infrastructure/locks/spin-lock.service";
import { PubSubLockService } from "@/common/infrastructure/locks/pubsub-lock.service";
import { FencingLockService } from "@/common/infrastructure/locks/fencing-lock.service";
import { QueueLockService } from "@/common/infrastructure/locks/queue-lock.service";
import { RedlockSpinLockService } from "@/common/infrastructure/locks/redlock-spin-lock.service";

// 락 전략 타입 정의
interface LockStrategy {
  name: string;
  useCase: any;
  lockKeyPrefix: string;
  description: string;
}

interface CouponIssueCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

describe("All Lock Strategies Concurrency Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let redisManager: RedisManager;

  // 락 전략들을 미리 정의 (UseCase는 나중에 할당)
  const lockStrategies: LockStrategy[] = [
    {
      name: "SpinLock",
      useCase: null, // beforeAll에서 할당
      lockKeyPrefix: "spinlock",
      description: "CPU 기반 폴링 방식",
    },
    {
      name: "PubSubLock",
      useCase: null, // beforeAll에서 할당
      lockKeyPrefix: "pubsub",
      description: "Redis Pub/Sub 기반 이벤트 방식",
    },
    {
      name: "FencingLock",
      useCase: null, // beforeAll에서 할당
      lockKeyPrefix: "fencing",
      description: "Fencing Token 기반 CAS 방식",
    },
    {
      name: "QueueLock",
      useCase: null, // beforeAll에서 할당
      lockKeyPrefix: "queue",
      description: "Redis Queue 기반 순차 처리",
    },
    {
      name: "RedlockSpinLock",
      useCase: null, // beforeAll에서 할당
      lockKeyPrefix: "redlock",
      description: "Redlock 알고리즘 기반 분산 락",
    },
  ];

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();
    dataSource = environment.dataSource;

    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);

    // ConfigService 모킹
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: environment.redisContainer!.getHost(),
          REDIS_PORT: environment.redisContainer!.getPort(),
          REDIS_DB: 0,
        };
        return config[key] || defaultValue;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(CouponTypeOrmEntity),
          useValue: couponRepository,
        },
        {
          provide: getRepositoryToken(UserCouponTypeOrmEntity),
          useValue: userCouponRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        // Base services
        CouponRepository,
        UserCouponRepository,
        ValidateUserCouponService,
        IssueUserCouponUseCase,
        RedisManager,
        // Lock services
        SpinLockService,
        PubSubLockService,
        FencingLockService,
        QueueLockService,
        RedlockSpinLockService,
        // UseCase services
        IssueUserCouponWithSpinLockUseCase,
        IssueUserCouponWithPubSubLockUseCase,
        IssueUserCouponWithFencingLockUseCase,
        IssueUserCouponWithQueueLockUseCase,
        IssueUserCouponWithRedlockSpinLockUseCase,
      ],
    }).compile();

    redisManager = moduleFixture.get<RedisManager>(RedisManager);

    // UseCase 인스턴스들을 각 전략에 할당
    lockStrategies[0].useCase =
      moduleFixture.get<IssueUserCouponWithSpinLockUseCase>(
        IssueUserCouponWithSpinLockUseCase
      );
    lockStrategies[1].useCase =
      moduleFixture.get<IssueUserCouponWithPubSubLockUseCase>(
        IssueUserCouponWithPubSubLockUseCase
      );
    lockStrategies[2].useCase =
      moduleFixture.get<IssueUserCouponWithFencingLockUseCase>(
        IssueUserCouponWithFencingLockUseCase
      );
    lockStrategies[3].useCase =
      moduleFixture.get<IssueUserCouponWithQueueLockUseCase>(
        IssueUserCouponWithQueueLockUseCase
      );
    lockStrategies[4].useCase =
      moduleFixture.get<IssueUserCouponWithRedlockSpinLockUseCase>(
        IssueUserCouponWithRedlockSpinLockUseCase
      );
  });

  afterAll(async () => {
    await redisManager.disconnect();
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.dataHelper.createTestUser();

    // Create additional test users for concurrent requests
    const hashedPassword = "hashed_password";
    const users = Array.from({ length: 50 }, (_, i) => ({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      password: hashedPassword,
      name: `테스트 사용자 ${i}`,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await dataSource
      .createQueryBuilder()
      .insert()
      .into("users")
      .values(users)
      .execute();

    // Reset factory counters
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();

    // Redis 클리어
    const redis = redisManager.getClient();
    await redis.flushdb();
  });

  // 공통 테스트 실행 함수
  const executeTestForStrategy = async (
    strategy: LockStrategy,
    testName: string,
    testFn: (strategy: LockStrategy) => Promise<void>
  ) => {
    console.log(`\n🔐 [${strategy.name}] ${testName}`);
    console.log(`   전략: ${strategy.description}`);
    await testFn(strategy);
  };

  const executeCouponIssue = async (
    strategy: LockStrategy,
    command: CouponIssueCommand
  ) => {
    return strategy.useCase.execute(command).catch((error) => ({ error }));
  };

  describe.each(lockStrategies.map((s) => [s.name, s]))(
    "%s Lock Strategy Tests",
    (strategyName, strategy: LockStrategy) => {
      it("다인 발급 - 제한된 수량의 쿠폰을 동시에 발급할 때 수량 제한이 정확히 지켜져야 함", async () => {
        await executeTestForStrategy(
          strategy,
          "다인 발급 테스트",
          async (strategy) => {
            // Given: 제한된 수량의 쿠폰 (총 5개)
            const totalCount = 5;
            const coupon = await CouponFactory.createAndSave(couponRepository, {
              couponCode: `${strategy.lockKeyPrefix.toUpperCase()}_LIMITED5`,
              discountValue: 1000,
              discountType: "FIXED",
              totalCount: totalCount,
              issuedCount: 0,
              endDate: new Date(Date.now() + 86400000), // 24시간 후
            });

            const concurrentRequests = 15; // 제한 수량보다 많은 요청

            // When: 동시에 여러 사용자가 쿠폰 발급 시도
            const issuePromises = Array.from(
              { length: concurrentRequests },
              (_, i) =>
                executeCouponIssue(strategy, {
                  couponId: coupon.id,
                  userId: `user-${i}`,
                  couponCode: `${strategy.lockKeyPrefix.toUpperCase()}_LIMITED5`,
                  idempotencyKey: `${strategy.lockKeyPrefix}-limited-issue-${i}`,
                })
            );

            const results = await Promise.all(issuePromises);

            // Then: 정확히 5개만 성공하고 나머지는 실패해야 함
            const successes = results.filter((result) => !("error" in result));
            const failures = results.filter((result) => "error" in result);

            expect(successes.length).toBe(totalCount);
            expect(failures.length).toBe(concurrentRequests - totalCount);

            // 쿠폰의 발급 수량 검증
            const updatedCoupon = await couponRepository.findOne({
              where: { id: coupon.id },
            });
            expect(updatedCoupon.issuedCount).toBe(totalCount);

            // 실제 발급된 사용자 쿠폰 수량 검증
            const issuedUserCoupons = await userCouponRepository.find({
              where: { couponId: coupon.id },
            });
            expect(issuedUserCoupons).toHaveLength(totalCount);

            console.log(
              `   ✅ 성공: ${successes.length}개, 실패: ${failures.length}개`
            );
          }
        );
      });

      it("일인 발급 - 한 명의 사용자가 동일한 쿠폰을 동시에 여러 번 발급 시도할 때 하나만 성공해야 함", async () => {
        await executeTestForStrategy(
          strategy,
          "일인 발급 테스트",
          async (strategy) => {
            // Given: 충분한 수량의 쿠폰
            const coupon = await CouponFactory.createAndSave(couponRepository, {
              couponCode: `${strategy.lockKeyPrefix.toUpperCase()}_SAMEUSER`,
              discountValue: 1000,
              discountType: "FIXED",
              totalCount: 100,
              issuedCount: 0,
              endDate: new Date(Date.now() + 86400000),
            });

            const concurrentRequests = 8;
            const targetUserId = "user-123";

            // When: 동일한 사용자가 동시에 같은 쿠폰 발급 시도 (다른 idempotencyKey)
            const issuePromises = Array.from(
              { length: concurrentRequests },
              (_, i) =>
                executeCouponIssue(strategy, {
                  couponId: coupon.id,
                  userId: targetUserId,
                  couponCode: `${strategy.lockKeyPrefix.toUpperCase()}_SAMEUSER`,
                  idempotencyKey: `${strategy.lockKeyPrefix}-same-user-issue-${i}`, // 각각 다른 idempotencyKey
                })
            );

            const results = await Promise.all(issuePromises);

            // Then: 하나만 성공하고 나머지는 실패해야 함 (중복 발급 방지)
            const successes = results.filter((result) => !("error" in result));
            const failures = results.filter((result) => "error" in result);

            expect(successes.length).toBe(1);
            expect(failures.length).toBe(concurrentRequests - 1);

            // 해당 사용자에게 하나의 쿠폰만 발급되었는지 확인
            const userCoupons = await userCouponRepository.find({
              where: { userId: targetUserId, couponId: coupon.id },
            });
            expect(userCoupons).toHaveLength(1);

            console.log(
              `   ✅ 성공: ${successes.length}개, 실패: ${failures.length}개`
            );
          }
        );
      });

      it("고강도 부하 테스트 - 많은 사용자가 제한된 수량의 쿠폰을 동시에 요청할 때 정확한 수량 제한", async () => {
        await executeTestForStrategy(
          strategy,
          "고강도 부하 테스트",
          async (strategy) => {
            // Given: 매우 제한된 수량의 쿠폰 (총 3개)
            const totalCount = 3;
            const coupon = await CouponFactory.createAndSave(couponRepository, {
              couponCode: `${strategy.lockKeyPrefix.toUpperCase()}_HIGH_LOAD`,
              discountValue: 5000,
              discountType: "FIXED",
              totalCount: totalCount,
              issuedCount: 0,
              endDate: new Date(Date.now() + 86400000),
            });

            const concurrentRequests = 30; // 많은 동시 요청

            console.log(
              `   📊 ${concurrentRequests}명의 사용자가 ${totalCount}개의 쿠폰을 동시에 요청`
            );

            // When: 많은 사용자가 동시에 쿠폰 발급 시도
            const startTime = Date.now();
            const issuePromises = Array.from(
              { length: concurrentRequests },
              (_, i) =>
                executeCouponIssue(strategy, {
                  couponId: coupon.id,
                  userId: `user-${i}`,
                  couponCode: `${strategy.lockKeyPrefix.toUpperCase()}_HIGH_LOAD`,
                  idempotencyKey: `${strategy.lockKeyPrefix}-high-load-issue-${i}`,
                })
            );

            const results = await Promise.all(issuePromises);
            const endTime = Date.now();

            // Then: 정확히 3개만 성공하고 나머지는 실패해야 함
            const successes = results.filter((result) => !("error" in result));
            const failures = results.filter((result) => "error" in result);

            expect(successes.length).toBe(totalCount);
            expect(failures.length).toBe(concurrentRequests - totalCount);

            console.log(`   ⏱️ 처리 시간: ${endTime - startTime}ms`);
            console.log(
              `   ✅ 성공: ${successes.length}개, 실패: ${failures.length}개`
            );

            // 최종 데이터 일관성 검증
            const updatedCoupon = await couponRepository.findOne({
              where: { id: coupon.id },
            });
            expect(updatedCoupon.issuedCount).toBe(totalCount);

            const issuedUserCoupons = await userCouponRepository.find({
              where: { couponId: coupon.id },
            });
            expect(issuedUserCoupons).toHaveLength(totalCount);

            // 모든 발급된 쿠폰이 ISSUED 상태인지 확인
            const allIssued = issuedUserCoupons.every(
              (uc) => uc.status === UserCouponStatus.ISSUED
            );
            expect(allIssued).toBe(true);
          }
        );
      });
    }
  );
});
