import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponStatus,
  UserCouponTypeOrmEntity,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { IssueUserCouponWithSpinLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-spin-lock.use-case";
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { RedisConfig } from "@/common/infrastructure/config/redis.config";
import { SpinLockService } from "@/common/infrastructure/locks/spin-lock.service";

describe("Coupon SpinLock Concurrency Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let issueUserCouponWithSpinLockUseCase: IssueUserCouponWithSpinLockUseCase;
  let redisConfig: RedisConfig;

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
        CouponRepository,
        UserCouponRepository,
        ValidateUserCouponService,
        IssueUserCouponUseCase,
        RedisConfig,
        SpinLockService,
        IssueUserCouponWithSpinLockUseCase,
      ],
    }).compile();

    issueUserCouponWithSpinLockUseCase =
      moduleFixture.get<IssueUserCouponWithSpinLockUseCase>(
        IssueUserCouponWithSpinLockUseCase
      );
    redisConfig = moduleFixture.get<RedisConfig>(RedisConfig);
  });

  afterAll(async () => {
    await redisConfig.disconnect();
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.dataHelper.createTestUser();

    // Create additional test users for concurrent requests
    const hashedPassword = "hashed_password";
    const users = Array.from({ length: 30 }, (_, i) => ({
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
  });

  describe("SpinLock을 사용한 쿠폰 발급", () => {
    it("다인 발급 - SpinLock으로 제한된 수량의 쿠폰을 동시에 발급할 때 수량 제한이 정확히 지켜져야 함", async () => {
      // Given: 제한된 수량의 쿠폰 (총 5개)
      const totalCount = 5;
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SPINLOCK_LIMITED5",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: totalCount,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000), // 24시간 후
      });

      const concurrentRequests = 15; // 제한 수량보다 많은 요청

      // When: 동시에 여러 사용자가 SpinLock을 사용하여 쿠폰 발급 시도
      const issuePromises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithSpinLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "SPINLOCK_LIMITED5",
            idempotencyKey: `spinlock-limited-issue-${i}`,
          })
          .catch((error) => ({ error }))
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
    });

    it("일인 발급 - SpinLock으로 한 명의 사용자가 동일한 쿠폰을 동시에 여러 번 발급 시도할 때 하나만 성공해야 함", async () => {
      // Given: 충분한 수량의 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SPINLOCK_SAMEUSER10",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 100,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      const concurrentRequests = 8;
      const targetUserId = "user-123";

      // When: 동일한 사용자가 동시에 같은 쿠폰 발급 시도 (다른 idempotencyKey)
      const issuePromises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithSpinLockUseCase
          .execute({
            couponId: coupon.id,
            userId: targetUserId,
            couponCode: "SPINLOCK_SAMEUSER10",
            idempotencyKey: `spinlock-same-user-issue-${i}`, // 각각 다른 idempotencyKey
          })
          .catch((error) => ({ error }))
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
    });

    it("고강도 부하 테스트 - 많은 사용자가 제한된 수량의 쿠폰을 동시에 요청할 때 정확한 수량 제한", async () => {
      // Given: 매우 제한된 수량의 쿠폰 (총 3개)
      const totalCount = 3;
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SPINLOCK_HIGH_LOAD",
        discountValue: 5000,
        discountType: "FIXED",
        totalCount: totalCount,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      const concurrentRequests = 50; // 매우 많은 동시 요청

      console.log(
        `${concurrentRequests}명의 사용자가 ${totalCount}개의 쿠폰을 동시에 요청`
      );

      // When: 많은 사용자가 동시에 쿠폰 발급 시도
      const startTime = Date.now();
      const issuePromises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithSpinLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "SPINLOCK_HIGH_LOAD",
            idempotencyKey: `high-load-issue-${i}`,
          })
          .catch((error) => ({ error, userId: `user-${i}` }))
      );

      const results = await Promise.all(issuePromises);
      const endTime = Date.now();

      console.log(`처리 시간: ${endTime - startTime}ms`);

      // Then: 정확히 3개만 성공하고 나머지는 실패해야 함
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(totalCount);
      expect(failures.length).toBe(concurrentRequests - totalCount);

      console.log(`성공: ${successes.length}개, 실패: ${failures.length}개`);

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
    });

    it("SpinLock 타임아웃 테스트 - 락 획득 실패 시 타임아웃 에러가 발생해야 함", async () => {
      // Given: 제한된 수량의 쿠폰
      const totalCount = 10;
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SPINLOCK_TIMEOUT_TEST",
        discountValue: 2000,
        discountType: "FIXED",
        totalCount: totalCount,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // 먼저 수동으로 락을 획득하여 충돌 상황 생성
      const lockKey = `spinlock:coupon:issue:${coupon.id}`;
      const lockValue = `test-lock-${Date.now()}`;
      const redis = redisConfig.getClient();
      await redis.set(lockKey, lockValue, "EX", 10); // 10초 동안 락 유지

      try {
        const concurrentRequests = 3;

        // When: 락이 이미 점유된 상태에서 쿠폰 발급 시도
        const issuePromises = Array.from(
          { length: concurrentRequests },
          (_, i) =>
            issueUserCouponWithSpinLockUseCase
              .execute({
                couponId: coupon.id,
                userId: `user-${i}`,
                couponCode: "SPINLOCK_TIMEOUT_TEST",
                idempotencyKey: `timeout-test-${i}`,
              })
              .catch((error) => ({ error, userId: `user-${i}` }))
        );

        const results = await Promise.all(issuePromises);

        // Then: 모든 요청이 타임아웃으로 실패해야 함
        const failures = results.filter((result) => "error" in result);
        expect(failures.length).toBe(concurrentRequests);

        // 타임아웃 에러 타입 확인
        failures.forEach((failure) => {
          expect(failure.error.message).toContain("스핀락 타임아웃");
        });

        console.log(`모든 ${failures.length}개 요청이 예상대로 타임아웃됨`);
      } finally {
        // 수동 락 해제
        await redis.del(lockKey);
      }
    });
  });
});
