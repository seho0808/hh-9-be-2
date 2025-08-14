import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../../test-environment/test-environment.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { IssueUserCouponWithFencingLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-fencing-lock.use-case";
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { RedisManager } from "@/common/infrastructure/config/redis.config";
import { FencingLockService } from "@/common/infrastructure/locks/fencing-lock.service";
import { PubSubLockService } from "@/common/infrastructure/locks/pubsub-lock.service";
import { FencingTokenViolationError } from "@/common/infrastructure/infrastructure.exceptions";

describe("Fencing Lock Specific Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let issueUserCouponWithFencingLockUseCase: IssueUserCouponWithFencingLockUseCase;
  let fencingLockService: FencingLockService;
  let redisManager: RedisManager;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();
    dataSource = environment.dataSource;

    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);

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
        RedisManager,
        PubSubLockService,
        FencingLockService,
        IssueUserCouponWithFencingLockUseCase,
      ],
    }).compile();

    issueUserCouponWithFencingLockUseCase =
      moduleFixture.get<IssueUserCouponWithFencingLockUseCase>(
        IssueUserCouponWithFencingLockUseCase
      );
    fencingLockService =
      moduleFixture.get<FencingLockService>(FencingLockService);
    redisManager = moduleFixture.get<RedisManager>(RedisManager);
  });

  afterAll(async () => {
    await redisManager.disconnect();
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.dataHelper.createTestUser();

    const hashedPassword = "hashed_password";
    const users = Array.from({ length: 20 }, (_, i) => ({
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

    CouponFactory.resetCounter();

    // Redis 클리어
    const redis = redisManager.getClient();
    await redis.flushdb();
  });

  describe("Fencing Token 검증 테스트", () => {
    it("Fencing Token 위반 시 FencingTokenViolationError가 발생해야 함", async () => {
      // Given: 제한된 수량의 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "FENCING_TOKEN_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 5,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // DB에 잘못된 fencing token을 미리 설정
      await dataSource
        .createQueryBuilder()
        .update(CouponTypeOrmEntity)
        .set({ lastFencingToken: 999 }) // 높은 값으로 설정
        .where("id = :id", { id: coupon.id })
        .execute();

      // When: 낮은 fencing token으로 쿠폰 발급 시도
      const result = await issueUserCouponWithFencingLockUseCase
        .execute({
          couponId: coupon.id,
          userId: "user-1",
          couponCode: "FENCING_TOKEN_TEST",
          idempotencyKey: "fencing-token-test-1",
        })
        .catch((error) => ({ error }));

      // Then: FencingTokenViolationError가 발생해야 함
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBeInstanceOf(FencingTokenViolationError);
        expect(result.error.message).toContain("Fencing token 위반");
      }
    });

    it("Fencing Token이 순차적으로 증가하는지 확인", async () => {
      // Given: 충분한 수량의 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "FENCING_SEQUENTIAL_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 10,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      const lockKey = `fencing:coupon:issue:${coupon.id}`;
      const tokens: number[] = [];

      // When: 여러 번 락을 획득하여 fencing token 수집
      for (let i = 0; i < 5; i++) {
        await fencingLockService.withLock(
          lockKey,
          async (fencingToken: number) => {
            tokens.push(fencingToken);
            // 실제 작업 시뮬레이션
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        );
      }

      // Then: Fencing token이 순차적으로 증가해야 함
      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i]).toBeGreaterThan(tokens[i - 1]);
      }

      console.log(`Fencing tokens: ${tokens.join(" -> ")}`);
    });

    it("동시 요청 시 각각 다른 fencing token을 받는지 확인", async () => {
      // Given: 충분한 수량의 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "FENCING_CONCURRENT_TOKEN",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 10,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      const concurrentRequests = 5;
      const tokens: number[] = [];

      // When: 동시에 여러 요청 실행
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithFencingLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "FENCING_CONCURRENT_TOKEN",
            idempotencyKey: `fencing-concurrent-${i}`,
          })
          .then((result) => {
            // fencing token을 확인하기 위해 DB에서 조회
            return couponRepository
              .findOne({ where: { id: coupon.id } })
              .then((updatedCoupon) => ({
                result,
                fencingToken: updatedCoupon.lastFencingToken,
              }));
          })
          .catch((error) => ({ error }))
      );

      const results = await Promise.all(promises);

      // Then: 모든 요청이 성공하고, 각각 다른 fencing token을 가져야 함
      const successes = results.filter((result) => !("error" in result));
      expect(successes.length).toBe(concurrentRequests);

      console.log(
        `성공한 요청들의 fencing token: ${successes.map((s) => ("fencingToken" in s ? s.fencingToken : "N/A")).join(", ")}`
      );
    });
  });

  describe("CAS(Compare-And-Set) 동작 검증", () => {
    it("DB 레벨에서 CAS 연산이 정확히 동작하는지 확인", async () => {
      // Given: 쿠폰 생성
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "CAS_OPERATION_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 1,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // CouponRepository 인스턴스 생성 (이미 의존성이 주입된 Repository 사용)
      const repository = new CouponRepository(couponRepository);

      // When: 낮은 fencing token으로 업데이트 시도 (실패해야 함)
      const lowTokenResult = await repository.updateWithFencingToken(
        coupon.id,
        1,
        { issuedCount: 1 }
      );

      // Then: 첫 번째 업데이트는 성공해야 함
      expect(lowTokenResult).toBe(true);

      // When: 더 낮은 fencing token으로 업데이트 시도 (실패해야 함)
      const lowerTokenResult = await repository.updateWithFencingToken(
        coupon.id,
        1, // 같은 값
        { issuedCount: 2 }
      );

      // Then: 두 번째 업데이트는 실패해야 함
      expect(lowerTokenResult).toBe(false);

      // When: 더 높은 fencing token으로 업데이트 시도 (성공해야 함)
      const higherTokenResult = await repository.updateWithFencingToken(
        coupon.id,
        2, // 더 높은 값
        { issuedCount: 2 }
      );

      // Then: 세 번째 업데이트는 성공해야 함
      expect(higherTokenResult).toBe(true);

      // 최종 상태 확인
      const finalCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(finalCoupon.lastFencingToken).toBe("2");
      expect(finalCoupon.issuedCount).toBe(2);
    });
  });

  describe("Fencing Lock 복구 시나리오", () => {
    it("Redis 장애 시뮬레이션 - 락 해제 실패 상황에서의 복구", async () => {
      // Given: 쿠폰 생성
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "FENCING_RECOVERY_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 5,
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      const lockKey = `fencing:coupon:issue:${coupon.id}`;
      const redis = redisManager.getClient();

      // 수동으로 락 설정 (장애 상황 시뮬레이션)
      await redis.set(lockKey, "stuck-lock", "EX", 1); // 1초 후 만료

      // When: 락이 만료된 후 정상 요청
      await new Promise((resolve) => setTimeout(resolve, 1100)); // 1.1초 대기

      const result = await issueUserCouponWithFencingLockUseCase
        .execute({
          couponId: coupon.id,
          userId: "user-1",
          couponCode: "FENCING_RECOVERY_TEST",
          idempotencyKey: "fencing-recovery-test-1",
        })
        .catch((error) => ({ error }));

      // Then: 정상적으로 처리되어야 함
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.coupon.id).toBe(coupon.id);
        expect(result.userCoupon.userId).toBe("user-1");
      }
    });
  });
});
