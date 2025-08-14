import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../../test-environment/test-environment.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { IssueUserCouponWithPubSubLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-pubsub-lock.use-case";
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { RedisManager } from "@/common/infrastructure/config/redis.config";
import { PubSubLockService } from "@/common/infrastructure/locks/pubsub-lock.service";

describe("PubSub Lock Specific Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let issueUserCouponWithPubSubLockUseCase: IssueUserCouponWithPubSubLockUseCase;
  let pubSubLockService: PubSubLockService;
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
        IssueUserCouponWithPubSubLockUseCase,
      ],
    }).compile();

    issueUserCouponWithPubSubLockUseCase =
      moduleFixture.get<IssueUserCouponWithPubSubLockUseCase>(
        IssueUserCouponWithPubSubLockUseCase
      );
    pubSubLockService = moduleFixture.get<PubSubLockService>(PubSubLockService);
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

  describe("PubSub 알림 메커니즘 테스트", () => {
    it("PubSub Lock의 동시성 제어가 정확히 작동하는지 확인", async () => {
      // Given: 단일 쿠폰으로 락 경합 테스트
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "PUBSUB_CONCURRENCY_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 1, // 단 1개만 발급 가능
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // When: 동시에 여러 요청으로 락 경합 생성
      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithPubSubLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "PUBSUB_CONCURRENCY_TEST",
            idempotencyKey: `pubsub-concurrency-${i}`,
          })
          .catch((error) => ({ error, userId: `user-${i}` }))
      );

      const results = await Promise.all(promises);

      // Then: 정확히 1개만 성공하고 나머지는 실패해야 함
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(concurrentRequests - 1);

      // 데이터베이스 상태 검증
      const updatedCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(updatedCoupon.issuedCount).toBe(1);

      console.log(`✅ PubSub Lock 동시성 제어 검증:`);
      console.log(
        `   - 성공: ${successes.length}개, 실패: ${failures.length}개`
      );
      console.log(`   - 데이터 일관성 유지됨`);
    });

    it("PubSub + 폴링 하이브리드 메커니즘이 정상 동작하는지 확인", async () => {
      // Given: 제한된 수량의 쿠폰으로 락 경합 상황 생성
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "PUBSUB_HYBRID_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 3, // 3개만 발급 가능하여 적절한 경합 발생
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // When: 높은 동시성으로 요청하여 PubSub 메커니즘 테스트
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithPubSubLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "PUBSUB_HYBRID_TEST",
            idempotencyKey: `pubsub-hybrid-${i}`,
          })
          .catch((error) => ({ error, userId: `user-${i}` }))
      );

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // Then: 정확히 3개만 성공하고 나머지는 실패해야 함
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(7);

      // 쿠폰 발급 수량 검증
      const updatedCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(updatedCoupon.issuedCount).toBe(3);

      console.log(`✅ PubSub 하이브리드 락 검증 완료:`);
      console.log(
        `   - 성공: ${successes.length}개, 실패: ${failures.length}개`
      );
      console.log(`   - 총 처리 시간: ${totalDuration}ms`);
      console.log(`   - PubSub + 폴링 메커니즘이 정상 동작함`);
    });
  });

  describe("PubSub Lock 성능 테스트", () => {
    it("높은 동시성 환경에서 PubSub Lock 성능 검증", async () => {
      // Given: 적당한 수량의 쿠폰으로 성능 테스트
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "PUBSUB_PERFORMANCE_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 5, // 5개 발급 가능
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // When: 높은 동시성으로 요청 실행
      const concurrentRequests = 15;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        issueUserCouponWithPubSubLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "PUBSUB_PERFORMANCE_TEST",
            idempotencyKey: `pubsub-performance-${i}`,
          })
          .catch((error) => ({ error, userId: `user-${i}` }))
      );

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // Then: 성능 및 정확성 검증
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(5);
      expect(failures.length).toBe(10);

      // 데이터베이스 일관성 검증
      const updatedCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(updatedCoupon.issuedCount).toBe(5);

      const throughput = (successes.length / totalDuration) * 1000;

      console.log(`📊 PubSub Lock 성능 테스트 결과:`);
      console.log(
        `   - 성공: ${successes.length}개, 실패: ${failures.length}개`
      );
      console.log(`   - 총 처리 시간: ${totalDuration}ms`);
      console.log(`   - 처리량: ${throughput.toFixed(2)} requests/sec`);
      console.log(`   - 데이터 일관성: ✅`);

      // 성능 기준: 15개 요청을 3초 내에 처리해야 함
      expect(totalDuration).toBeLessThan(3000);
    });
  });

  describe("PubSub Lock 안정성 테스트", () => {
    it("PubSub Lock이 안정적으로 동작하는지 검증", async () => {
      // Given: 여러 쿠폰 발급 가능한 상황
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "PUBSUB_STABILITY_TEST",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 3, // 3개 발급 가능
        issuedCount: 0,
        endDate: new Date(Date.now() + 86400000),
      });

      // When: 정확히 쿠폰 수량만큼 요청
      const promises = Array.from({ length: 3 }, (_, i) =>
        issueUserCouponWithPubSubLockUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "PUBSUB_STABILITY_TEST",
            idempotencyKey: `pubsub-stability-${i}`,
          })
          .catch((error) => ({ error, userId: `user-${i}` }))
      );

      const results = await Promise.all(promises);

      // Then: 모든 요청이 성공해야 함 (경합 없는 상황)
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(0);

      // 데이터베이스 일관성 검증
      const updatedCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(updatedCoupon.issuedCount).toBe(3);

      console.log(`✅ PubSub Lock 안정성 검증 완료:`);
      console.log(`   - 모든 요청 성공: ${successes.length}개`);
      console.log(`   - 하이브리드 메커니즘 안정적 동작 확인`);
    });
  });
});
