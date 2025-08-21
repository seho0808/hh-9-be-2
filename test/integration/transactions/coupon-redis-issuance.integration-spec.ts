import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { CouponRedisRepository } from "@/coupon/infrastructure/persistence/coupon-redis.repository";
import { IssueUserCouponWithRedisUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon-with-redis.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";
import { UserRepository } from "@/user/infrastructure/persistence/user.repository";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { CouponExhaustedError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { DuplicateIdempotencyKeyError } from "@/coupon/application/coupon.application.exceptions";
import { RedisManager } from "@/common/infrastructure/config/redis.config";
import { DataSource, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { UserFactory } from "@/user/infrastructure/persistence/factories/user.factory";

describe("Redis 기반 쿠폰 발급 통합 테스트", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let moduleRef: TestingModule;
  let couponRedisRepository: CouponRedisRepository;
  let issueUserCouponWithRedisUseCase: IssueUserCouponWithRedisUseCase;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let userRepository: Repository<UserTypeOrmEntity>;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseAndRedisEnvironment();
    dataSource = environment.dataSource;

    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    userRepository = dataSource.getRepository(UserTypeOrmEntity);

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

    moduleRef = await Test.createTestingModule({
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
          provide: getRepositoryToken(UserTypeOrmEntity),
          useValue: userRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        CouponRedisRepository,
        IssueUserCouponWithRedisUseCase,
        CouponRepository,
        UserCouponRepository,
        UserRepository,
        RedisManager,
      ],
    }).compile();

    couponRedisRepository = moduleRef.get<CouponRedisRepository>(
      CouponRedisRepository
    );
    issueUserCouponWithRedisUseCase =
      moduleRef.get<IssueUserCouponWithRedisUseCase>(
        IssueUserCouponWithRedisUseCase
      );
  });

  afterAll(async () => {
    await moduleRef?.close();
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.redisHelper.flushAll();
  });

  describe("전체 쿠폰 발급 플로우", () => {
    it("Redis 기반으로 성공적으로 쿠폰을 발급한다", async () => {
      // Given: 사용자와 쿠폰 준비
      const user = await UserFactory.createAndSave(userRepository, {
        email: "test@example.com",
        password: "hashedpassword",
        name: "Test User",
      });
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        totalCount: 100,
        couponCode: "TEST2024",
      });

      // Redis 초기화 (countdown 방식)
      await couponRedisRepository.initializeRemainingCount(coupon.id, 100);

      const command = {
        couponId: coupon.id,
        userId: user.id,
        couponCode: "TEST2024",
        idempotencyKey: uuidv4(),
      };

      // When: 쿠폰 발급 실행
      const result = await issueUserCouponWithRedisUseCase.execute(command);

      // Then: 결과 검증
      expect(result.userCoupon).toBeDefined();
      expect(result.userCoupon.couponId).toBe(coupon.id);
      expect(result.userCoupon.userId).toBe(user.id);

      // Redis 카운터 확인
      const remainingCount = await couponRedisRepository.getRemainingCount(
        coupon.id
      );
      expect(remainingCount).toBe(99);

      // DB에 userCoupon 저장 확인
      const savedUserCoupon = await userCouponRepository.findOne({
        where: {
          id: result.userCoupon.id,
        },
      });
      expect(savedUserCoupon).toBeDefined();
    });

    it("쿠폰이 소진된 경우 발급에 실패한다", async () => {
      // Given: 사용자와 한정 쿠폰 준비
      const user = await UserFactory.createAndSave(userRepository, {
        email: "test2@example.com",
        password: "hashedpassword",
        name: "Test User 2",
      });
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        totalCount: 1,
        couponCode: "LIMITED2024",
      });

      // Redis에 이미 소진된 상태로 설정
      await couponRedisRepository.initializeRemainingCount(coupon.id, 0);

      const command = {
        couponId: coupon.id,
        userId: user.id,
        couponCode: "LIMITED2024",
        idempotencyKey: uuidv4(),
      };

      // When & Then: 소진 에러 발생해야 함
      await expect(
        issueUserCouponWithRedisUseCase.execute(command)
      ).rejects.toThrow(CouponExhaustedError);

      // Redis 카운터가 변경되지 않았는지 확인
      const remainingCount = await couponRedisRepository.getRemainingCount(
        coupon.id
      );
      expect(remainingCount).toBe(0);
    });

    it("DB 저장 실패 시 Redis 카운터를 롤백한다", async () => {
      // Given: 사용자와 쿠폰 준비
      const user = await UserFactory.createAndSave(userRepository, {
        email: "test3@example.com",
        password: "hashedpassword",
        name: "Test User 3",
      });
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        totalCount: 100,
        couponCode: "ROLLBACK2024",
      });

      await couponRedisRepository.initializeRemainingCount(coupon.id, 100);

      // 중복 idempotency key로 미리 저장 (충돌 유발)
      const duplicateKey = uuidv4();
      const existingUserCouponEntity = UserCouponFactory.create({
        couponId: coupon.id,
        userId: user.id,
        issuedIdempotencyKey: duplicateKey,
      });

      // TypeORM Repository를 통해 직접 저장
      await userCouponRepository.save(existingUserCouponEntity);

      const command = {
        couponId: coupon.id,
        userId: user.id,
        couponCode: "ROLLBACK2024",
        idempotencyKey: duplicateKey, // 중복된 키 사용
      };

      // When & Then: 중복 키 에러 발생해야 함
      await expect(
        issueUserCouponWithRedisUseCase.execute(command)
      ).rejects.toThrow(DuplicateIdempotencyKeyError);

      // Redis 카운터가 롤백되었는지 확인
      const remainingCount = await couponRedisRepository.getRemainingCount(
        coupon.id
      );
      expect(remainingCount).toBe(100); // 롤백되어 원래 상태
    });

    it("동시 발급 시 정확한 수량만 발급되고 DB 정합성이 유지된다", async () => {
      // Given: 사용자들과 제한된 쿠폰 준비
      const users = await UserFactory.createManyWithOptionsAndSave(
        userRepository,
        [
          {
            email: "user1@example.com",
            password: "hashedpassword",
            name: "User 1",
          },
          {
            email: "user2@example.com",
            password: "hashedpassword",
            name: "User 2",
          },
          {
            email: "user3@example.com",
            password: "hashedpassword",
            name: "User 3",
          },
          {
            email: "user4@example.com",
            password: "hashedpassword",
            name: "User 4",
          },
          {
            email: "user5@example.com",
            password: "hashedpassword",
            name: "User 5",
          },
        ]
      );

      const coupon = await CouponFactory.createAndSave(couponRepository, {
        totalCount: 3, // 3개만 발급 가능
        couponCode: "CONCURRENT2024",
      });

      await couponRedisRepository.initializeRemainingCount(coupon.id, 3);

      // When: 5명이 동시에 발급 시도
      const commands = users.map((user) => ({
        couponId: coupon.id,
        userId: user.id,
        couponCode: "CONCURRENT2024",
        idempotencyKey: uuidv4(),
      }));

      const results = await Promise.allSettled(
        commands.map((command) =>
          issueUserCouponWithRedisUseCase.execute(command)
        )
      );

      // Then: 정확히 3개만 성공해야 함
      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(successful.length).toBe(3);
      expect(failed.length).toBe(2);

      // Redis 상태 확인
      const finalRemaining = await couponRedisRepository.getRemainingCount(
        coupon.id
      );
      expect(finalRemaining).toBe(0);

      // DB 정합성 확인
      const dbUserCoupons = await Promise.all(
        successful.map((result) => {
          const userCoupon = (result as PromiseFulfilledResult<any>).value
            .userCoupon;
          return userCouponRepository.findOne({
            where: {
              id: userCoupon.id,
            },
          });
        })
      );

      expect(dbUserCoupons.every((uc) => uc !== null)).toBe(true);
      expect(dbUserCoupons.length).toBe(3);
    });
  });
});
