import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponStatus,
  UserCouponTypeOrmEntity,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { CancelUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/cancel-user-coupon.use-case";
import { UseUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { CouponNotFoundError } from "@/coupon/application/coupon.application.exceptions";
import { UserCouponNotFoundError } from "@/coupon/application/coupon.application.exceptions";

describe("Coupon Domain Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let issueUserCouponUseCase: IssueUserCouponUseCase;
  let cancelUserCouponUseCase: CancelUserCouponUseCase;
  let useUserCouponUseCase: UseUserCouponUseCase;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupDatabaseOnly();
    dataSource = setup.dataSource;

    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);

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
        CouponRepository,
        UserCouponRepository,
        ValidateUserCouponService,
        IssueUserCouponUseCase,
        CancelUserCouponUseCase,
        UseUserCouponUseCase,
      ],
    }).compile();

    issueUserCouponUseCase = moduleFixture.get<IssueUserCouponUseCase>(
      IssueUserCouponUseCase
    );
    cancelUserCouponUseCase = moduleFixture.get<CancelUserCouponUseCase>(
      CancelUserCouponUseCase
    );
    useUserCouponUseCase =
      moduleFixture.get<UseUserCouponUseCase>(UseUserCouponUseCase);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource);

    // Reset factory counters
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();
  });

  describe("IssueUserCouponUseCase (@Transactional)", () => {
    it("쿠폰 발급이 성공적으로 처리되어야 함", async () => {
      // Given: 활성화된 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SAVE10",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 100,
        usedCount: 0,
        endDate: new Date(Date.now() + 86400000), // 24시간 후
      });

      // When: 사용자에게 쿠폰을 발급
      const command = {
        couponId: coupon.id,
        userId: "user-123",
        couponCode: "SAVE10",
        idempotencyKey: "issue-coupon-key-1",
      };

      const result = await issueUserCouponUseCase.execute(command);

      // Then: 사용자 쿠폰이 발급되어야 함
      expect(result.coupon.id).toBe(coupon.id);
      expect(result.userCoupon.userId).toBe("user-123");
      expect(result.userCoupon.couponId).toBe(coupon.id);
      expect(result.userCoupon.status).toBe("ISSUED");

      // DB 검증
      const savedUserCoupon = await userCouponRepository.findOne({
        where: { userId: "user-123", couponId: coupon.id },
      });
      expect(savedUserCoupon).toBeDefined();
      expect(savedUserCoupon.status).toBe(UserCouponStatus.ISSUED);

      // 쿠폰 사용량 증가 확인
      const updatedCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(updatedCoupon.issuedCount).toBe(1);
    });

    it("존재하지 않는 쿠폰에 대해 예외가 발생해야 함", async () => {
      // Given: 존재하지 않는 쿠폰 ID

      // When & Then: 쿠폰을 찾을 수 없음으로 예외 발생
      const command = {
        couponId: "non-existent-coupon",
        userId: "user-123",
        couponCode: "INVALID",
        idempotencyKey: "issue-invalid-coupon-key",
      };

      await expect(issueUserCouponUseCase.execute(command)).rejects.toThrow(
        CouponNotFoundError
      );
    });

    it.skip("동일한 idempotencyKey로 중복 발급 시 중복이 방지되어야 함", async () => {
      // Given: 쿠폰과 첫 번째 발급
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "DUPLICATE10",
        discountValue: 1000,
        totalCount: 100,
        usedCount: 0,
      });

      const command = {
        couponId: coupon.id,
        userId: "user-123",
        couponCode: "DUPLICATE10",
        idempotencyKey: "duplicate-issue-key",
      };

      // When: 동일한 idempotencyKey로 두 번 발급 시도
      const result1 = await issueUserCouponUseCase.execute(command);

      // Then: 중복 발급이 방지되어야 함
      await expect(issueUserCouponUseCase.execute(command)).rejects.toThrow();

      // DB 검증 - 하나의 사용자 쿠폰만 생성되어야 함
      const userCoupons = await userCouponRepository.find({
        where: { userId: "user-123", couponId: coupon.id },
      });
      expect(userCoupons).toHaveLength(1);
    });

    it("최대 사용 한도를 초과한 쿠폰에 대해 예외가 발생해야 함", async () => {
      // Given: 사용량이 한도에 도달한 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "LIMIT1",
        discountValue: 1000,
        totalCount: 1,
        issuedCount: 1, // 이미 한도 도달
      });

      // When & Then: 한도 초과로 예외 발생
      const command = {
        couponId: coupon.id,
        userId: "user-123",
        couponCode: "LIMIT1",
        idempotencyKey: "exceed-limit-key",
      };

      await expect(issueUserCouponUseCase.execute(command)).rejects.toThrow();
    });
  });

  describe("UseUserCouponUseCase (@Transactional)", () => {
    it("쿠폰 사용이 성공적으로 처리되어야 함", async () => {
      // Given: 발급된 사용자 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "USE10",
        discountValue: 1000,
        discountType: "FIXED",
        minimumOrderPrice: 1000, // 최소 주문 금액을 낮게 설정
        totalCount: 100,
        usedCount: 0,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.ISSUED,
          expiresAt: new Date(Date.now() + 86400000),
        }
      );

      // When: 쿠폰을 사용
      const command = {
        couponId: coupon.id,
        userId: "user-123",
        orderId: null, // orderId를 null로 설정하여 외래키 제약 우회
        orderPrice: 5000,
        idempotencyKey: "use-coupon-key-1",
      };

      const result = await useUserCouponUseCase.execute(command);

      // Then: 쿠폰이 성공적으로 사용되어야 함
      expect(result.userCoupon.status).toBe(UserCouponStatus.USED);
      expect(result.userCoupon.discountPrice).toBe(1000);
      expect(result.userCoupon.usedAt).toBeInstanceOf(Date);
    });

    it("퍼센트 할인 쿠폰이 정확히 계산되어야 함", async () => {
      // Given: 퍼센트 할인 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "PERCENT10",
        discountValue: 10, // 10% 할인
        discountType: "PERCENTAGE",
        minimumOrderPrice: 5000, // 최소 주문 금액을 낮게 설정
        maxDiscountPrice: 3000, // 최대 할인 금액
        totalCount: 100,
        usedCount: 0,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.ISSUED,
          expiresAt: new Date(Date.now() + 86400000),
        }
      );

      // When: 쿠폰을 사용
      const command = {
        couponId: coupon.id,
        userId: "user-123",
        orderId: null, // orderId를 null로 설정
        orderPrice: 20000, // 20,000원 주문
        idempotencyKey: "use-percent-coupon-key-1",
      };

      const result = await useUserCouponUseCase.execute(command);

      // Then: 10% 할인이 적용되어야 함 (2,000원 할인)
      expect(result.userCoupon.status).toBe(UserCouponStatus.USED);
      expect(result.userCoupon.discountPrice).toBe(2000); // 20,000의 10%
      expect(result.userCoupon.usedAt).toBeInstanceOf(Date);
    });

    it("이미 사용된 쿠폰에 대해 예외가 발생해야 함", async () => {
      // Given: 이미 사용된 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "USED10",
        discountValue: 1000,
        discountType: "FIXED",
        minimumOrderPrice: 1000,
        totalCount: 100,
        usedCount: 1,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.USED, // 이미 사용됨
          orderId: null,
          discountPrice: 1000,
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        }
      );

      // When & Then: 이미 사용된 쿠폰으로 예외 발생
      const command = {
        couponId: coupon.id,
        userId: "user-123",
        orderId: null,
        orderPrice: 5000,
        idempotencyKey: "use-used-coupon-key",
      };

      await expect(useUserCouponUseCase.execute(command)).rejects.toThrow();
    });

    it("만료된 쿠폰에 대해 예외가 발생해야 함", async () => {
      // Given: 만료된 사용자 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "EXPIRED10",
        discountValue: 1000,
        totalCount: 100,
        usedCount: 0,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.ISSUED,
          expiresAt: new Date(Date.now() - 86400000), // 24시간 전 만료
        }
      );

      // When & Then: 만료된 쿠폰으로 예외 발생
      const command = {
        couponId: coupon.id,
        userId: "user-123",
        orderId: "order-789",
        orderPrice: 5000,
        idempotencyKey: "use-expired-coupon-key",
      };

      await expect(useUserCouponUseCase.execute(command)).rejects.toThrow();
    });
  });

  describe("CancelUserCouponUseCase (@Transactional)", () => {
    it("쿠폰 취소가 성공적으로 처리되어야 함", async () => {
      // Given: 발급된 사용자 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "CANCEL10",
        discountValue: 1000,
        discountType: "FIXED",
        minimumOrderPrice: 1000,
        totalCount: 100,
        issuedCount: 1,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.ISSUED,
          expiresAt: new Date(Date.now() + 86400000),
        }
      );

      // When: 쿠폰을 취소
      const command = {
        userCouponId: userCoupon.id,
        userId: "user-123",
        orderId: null,
      };

      const result = await cancelUserCouponUseCase.execute(command);

      // Then: 쿠폰이 성공적으로 취소되어야 함
      expect(result.userCoupon.status).toBe(UserCouponStatus.CANCELLED);
      expect(result.userCoupon.cancelledAt).toBeInstanceOf(Date);
    });

    it("존재하지 않는 사용자 쿠폰에 대해 예외가 발생해야 함", async () => {
      // When & Then: 존재하지 않는 쿠폰 ID로 예외 발생
      const command = {
        userCouponId: "non-existent-coupon-id",
        userId: "user-123",
        orderId: null,
      };

      await expect(cancelUserCouponUseCase.execute(command)).rejects.toThrow(
        UserCouponNotFoundError
      );
    });

    it.skip("이미 사용된 쿠폰은 취소할 수 없어야 함", async () => {
      // Given: 이미 사용된 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "USED_CANCEL10",
        discountValue: 1000,
        discountType: "FIXED",
        minimumOrderPrice: 1000,
        totalCount: 100,
        usedCount: 1,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.USED, // 이미 사용됨
          orderId: null,
          discountPrice: 1000,
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        }
      );

      // When & Then: 이미 사용된 쿠폰 취소 시도로 예외 발생
      const command = {
        userCouponId: userCoupon.id,
        userId: "user-123",
        orderId: null,
      };

      await expect(cancelUserCouponUseCase.execute(command)).rejects.toThrow();
    });
  });

  describe("Coupon Lifecycle Integration", () => {
    it("쿠폰의 전체 생명주기가 올바르게 관리되어야 함", async () => {
      // Given: 새로운 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "LIFECYCLE10",
        discountValue: 1000,
        discountType: "FIXED",
        minimumOrderPrice: 1000, // 최소 주문 금액을 낮게 설정
        totalCount: 1,
        issuedCount: 0,
        usedCount: 0,
      });

      // When: 쿠폰 발급
      const issueCommand = {
        couponId: coupon.id,
        userId: "user-123",
        couponCode: "LIFECYCLE10",
        idempotencyKey: "lifecycle-issue-key",
      };

      const issueResult = await issueUserCouponUseCase.execute(issueCommand);
      expect(issueResult.userCoupon.status).toBe(UserCouponStatus.ISSUED);

      // When: 쿠폰 사용
      const useCommand = {
        couponId: coupon.id,
        userId: "user-123",
        orderId: null,
        orderPrice: 5000,
        idempotencyKey: "lifecycle-use-key",
      };

      const useResult = await useUserCouponUseCase.execute(useCommand);

      // Then: 쿠폰의 전체 생명주기가 올바르게 처리되어야 함
      expect(useResult.userCoupon.status).toBe(UserCouponStatus.USED);
      expect(useResult.userCoupon.discountPrice).toBe(1000);
      expect(useResult.userCoupon.usedAt).toBeInstanceOf(Date);
    });
  });
});
