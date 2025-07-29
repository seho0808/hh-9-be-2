import { Test } from "@nestjs/testing";
import { UseUserCouponUseCase } from "./use-user-coupon.use-case";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import {
  UserCouponAlreadyUsedError,
  UserCouponCancelledError,
  UserCouponExpiredError,
} from "@/coupon/domain/exceptions/user-coupon.exception";
import {
  Coupon,
  CouponDiscountType,
} from "@/coupon/domain/entities/coupon.entity";
import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { v4 as uuidv4 } from "uuid";
import { UseUserCouponDomainService } from "@/coupon/domain/services/use-user-coupon.service";

describe("UserCouponUseCase", () => {
  let useCase: UseUserCouponUseCase;
  let couponRepository: any;
  let userCouponRepository: any;

  beforeEach(async () => {
    couponRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    userCouponRepository = {
      findByCouponIdAndUserId: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UseUserCouponUseCase,
        UseUserCouponDomainService,
        {
          provide: "CouponRepositoryInterface",
          useValue: couponRepository,
        },
        {
          provide: "UserCouponRepositoryInterface",
          useValue: userCouponRepository,
        },
      ],
    }).compile();

    useCase = module.get<UseUserCouponUseCase>(UseUserCouponUseCase);
  });

  describe("쿠폰 사용 성공 케이스", () => {
    describe("고정 금액(FIXED) 할인 쿠폰", () => {
      it("정상적으로 쿠폰이 사용되어야 한다", async () => {
        const coupon = Coupon.create({
          name: "10000원 할인 쿠폰",
          description: "10000원 할인",
          couponCode: "FIXED10000",
          discountType: CouponDiscountType.FIXED,
          discountValue: 10000,
          minimumOrderPrice: 50000,
          maxDiscountPrice: null,
          totalCount: 100,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          expiresInDays: 7,
        });

        const userCoupon = UserCoupon.create({
          couponId: coupon.id,
          userId: uuidv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issuedIdempotencyKey: uuidv4(),
        });

        couponRepository.findById.mockResolvedValue(coupon);
        userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
          userCoupon
        );

        const orderId = uuidv4();
        const result = await useCase.execute({
          couponId: coupon.id,
          userId: userCoupon.userId,
          orderId,
          orderPrice: 60000,
          idempotencyKey: uuidv4(),
        });

        expect(result.discountPrice).toBe(10000);
        expect(result.discountedPrice).toBe(50000);
        expect(result.userCoupon.status).toBe(UserCouponStatus.USED);
        expect(result.userCoupon.orderId).toBe(orderId);
        expect(result.userCoupon.discountPrice).toBe(10000);
        expect(couponRepository.save).toHaveBeenCalledWith(coupon);
        expect(userCouponRepository.save).toHaveBeenCalledWith(userCoupon);
      });
    });

    describe("퍼센트(PERCENTAGE) 할인 쿠폰", () => {
      it("최대 할인 금액이 적용되어야 한다", async () => {
        const coupon = Coupon.create({
          name: "50% 할인 쿠폰",
          description: "최대 20000원",
          couponCode: "PERCENT50",
          discountType: CouponDiscountType.PERCENTAGE,
          discountValue: 50,
          minimumOrderPrice: 10000,
          maxDiscountPrice: 20000,
          totalCount: 100,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          expiresInDays: 7,
        });

        const userCoupon = UserCoupon.create({
          couponId: coupon.id,
          userId: uuidv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issuedIdempotencyKey: uuidv4(),
        });

        couponRepository.findById.mockResolvedValue(coupon);
        userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
          userCoupon
        );

        const result = await useCase.execute({
          couponId: coupon.id,
          userId: userCoupon.userId,
          orderId: uuidv4(),
          orderPrice: 100000, // 50% = 50000원이지만 최대 20000원으로 제한
          idempotencyKey: uuidv4(),
        });

        expect(result.discountPrice).toBe(20000);
        expect(result.discountedPrice).toBe(80000);
      });

      it("최대 할인 금액 제한이 없을 때 퍼센트 할인이 그대로 적용되어야 한다", async () => {
        const coupon = Coupon.create({
          name: "30% 할인 쿠폰",
          description: "제한 없음",
          couponCode: "PERCENT30",
          discountType: CouponDiscountType.PERCENTAGE,
          discountValue: 30,
          minimumOrderPrice: 10000,
          maxDiscountPrice: null,
          totalCount: 100,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          expiresInDays: 7,
        });

        const userCoupon = UserCoupon.create({
          couponId: coupon.id,
          userId: uuidv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issuedIdempotencyKey: uuidv4(),
        });

        couponRepository.findById.mockResolvedValue(coupon);
        userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
          userCoupon
        );

        const result = await useCase.execute({
          couponId: coupon.id,
          userId: userCoupon.userId,
          orderId: uuidv4(),
          orderPrice: 100000,
          idempotencyKey: uuidv4(),
        });

        expect(result.discountPrice).toBe(30000);
        expect(result.discountedPrice).toBe(70000);
      });

      it("소수점이 발생하는 퍼센트 할인 시 소수점 버림이 적용되어야 한다", async () => {
        const coupon = Coupon.create({
          name: "10% 할인 쿠폰",
          description: "소수점 버림 테스트",
          couponCode: "PERCENT10",
          discountType: CouponDiscountType.PERCENTAGE,
          discountValue: 10,
          minimumOrderPrice: 1000,
          maxDiscountPrice: null,
          totalCount: 100,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          expiresInDays: 7,
        });

        const userCoupon = UserCoupon.create({
          couponId: coupon.id,
          userId: uuidv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          issuedIdempotencyKey: uuidv4(),
        });

        couponRepository.findById.mockResolvedValue(coupon);
        userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
          userCoupon
        );

        const result = await useCase.execute({
          couponId: coupon.id,
          userId: userCoupon.userId,
          orderId: uuidv4(),
          orderPrice: 1235, // 10% = 123.5원 → 123원 (소수점 버림)
          idempotencyKey: uuidv4(),
        });

        expect(result.discountPrice).toBe(123); // 123.5가 아닌 123원
        expect(result.discountedPrice).toBe(1112); // 1235 - 123 = 1112원
      });
    });
  });

  describe("쿠폰 사용 실패 케이스", () => {
    it("존재하지 않는 쿠폰 ID로 요청시 에러가 발생해야 한다", async () => {
      const nonExistentCouponId = uuidv4();
      couponRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          couponId: nonExistentCouponId,
          userId: uuidv4(),
          orderId: uuidv4(),
          orderPrice: 10000,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(CouponNotFoundError);
    });

    it("만료된 사용자 쿠폰으로 요청시 에러가 발생해야 한다", async () => {
      const coupon = Coupon.create({
        name: "만료 테스트 쿠폰",
        description: "만료 테스트",
        couponCode: "EXPIRED",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expiresInDays: 7,
      });

      const expiredUserCoupon = UserCoupon.create({
        couponId: coupon.id,
        userId: uuidv4(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 하루 전 만료
        issuedIdempotencyKey: uuidv4(),
      });

      couponRepository.findById.mockResolvedValue(coupon);
      userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
        expiredUserCoupon
      );

      await expect(
        useCase.execute({
          couponId: coupon.id,
          userId: expiredUserCoupon.userId,
          orderId: uuidv4(),
          orderPrice: 60000,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(UserCouponExpiredError);
    });

    it("이미 사용된 쿠폰으로 요청시 에러가 발생해야 한다", async () => {
      const coupon = Coupon.create({
        name: "사용됨 테스트 쿠폰",
        description: "사용됨 테스트",
        couponCode: "USED",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expiresInDays: 7,
      });

      const userCoupon = UserCoupon.create({
        couponId: coupon.id,
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      userCoupon.use("previous-order", 10000, uuidv4());

      couponRepository.findById.mockResolvedValue(coupon);
      userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
        userCoupon
      );

      await expect(
        useCase.execute({
          couponId: coupon.id,
          userId: userCoupon.userId,
          orderId: uuidv4(),
          orderPrice: 60000,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(UserCouponAlreadyUsedError);
    });

    it("취소된 쿠폰으로 요청시 에러가 발생해야 한다", async () => {
      const coupon = Coupon.create({
        name: "취소됨 테스트 쿠폰",
        description: "취소됨 테스트",
        couponCode: "CANCELLED",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expiresInDays: 7,
      });

      const userCoupon = UserCoupon.create({
        couponId: coupon.id,
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      userCoupon.cancel();

      couponRepository.findById.mockResolvedValue(coupon);
      userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
        userCoupon
      );

      await expect(
        useCase.execute({
          couponId: coupon.id,
          userId: userCoupon.userId,
          orderId: uuidv4(),
          orderPrice: 60000,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(UserCouponCancelledError);
    });
  });
});
