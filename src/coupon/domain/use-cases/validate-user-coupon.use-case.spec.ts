import { Test } from "@nestjs/testing";
import { ValidateCouponUseCase } from "./validate-user-coupon.use-case";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import {
  Coupon,
  CouponDiscountType,
} from "@/coupon/domain/entities/coupon.entity";
import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { v4 as uuidv4 } from "uuid";

describe("ValidateCouponUseCase", () => {
  let useCase: ValidateCouponUseCase;
  let couponRepository: any;
  let userCouponRepository: any;

  beforeEach(async () => {
    couponRepository = {
      findById: jest.fn(),
    };

    userCouponRepository = {
      findByCouponIdAndUserId: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ValidateCouponUseCase,
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

    useCase = module.get<ValidateCouponUseCase>(ValidateCouponUseCase);
  });

  describe("고정 금액(FIXED) 할인 쿠폰 검증", () => {
    it("주문 금액이 최소 주문 금액 이상일 때 할인이 적용되어야 한다", async () => {
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

      const result = await useCase.execute({
        couponId: coupon.id,
        userId: userCoupon.userId,
        orderPrice: 60000,
      });

      expect(result.isValid).toBe(true);
      expect(result.discountPrice).toBe(10000);
      expect(result.discountedPrice).toBe(50000); // 60000 - 10000
    });

    it("주문 금액이 최소 주문 금액 미만일 때 할인이 적용되지 않아야 한다", async () => {
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

      const result = await useCase.execute({
        couponId: coupon.id,
        userId: userCoupon.userId,
        orderPrice: 40000,
      });

      expect(result.isValid).toBe(false);
      expect(result.discountPrice).toBe(0);
      expect(result.discountedPrice).toBe(40000); // 원래 주문 금액 그대로
    });
  });

  describe("퍼센트(PERCENTAGE) 할인 쿠폰 검증", () => {
    it("최대 할인 금액 제한이 있을 때 할인 금액이 제한되어야 한다", async () => {
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
        orderPrice: 100000, // 50% = 50000원이지만 최대 20000원으로 제한
      });

      expect(result.isValid).toBe(true);
      expect(result.discountPrice).toBe(20000);
      expect(result.discountedPrice).toBe(80000); // 100000 - 20000
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
        orderPrice: 100000,
      });

      expect(result.isValid).toBe(true);
      expect(result.discountPrice).toBe(30000); // 100000 * 0.3
      expect(result.discountedPrice).toBe(70000); // 100000 - 30000
    });
  });

  describe("사용자 쿠폰 상태에 따른 검증", () => {
    it("만료된 사용자 쿠폰은 사용할 수 없어야 한다", async () => {
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

      const result = await useCase.execute({
        couponId: coupon.id,
        userId: expiredUserCoupon.userId,
        orderPrice: 60000,
      });

      expect(result.isValid).toBe(false);
      expect(result.discountPrice).toBe(0);
      expect(result.discountedPrice).toBe(60000); // 원래 주문 금액 그대로
    });

    it("이미 사용된 쿠폰은 사용할 수 없어야 한다", async () => {
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

      const usedUserCoupon = UserCoupon.create({
        couponId: coupon.id,
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      usedUserCoupon.use("order-1", 10000, uuidv4()); // 쿠폰 사용 처리

      couponRepository.findById.mockResolvedValue(coupon);
      userCouponRepository.findByCouponIdAndUserId.mockResolvedValue(
        usedUserCoupon
      );

      const result = await useCase.execute({
        couponId: coupon.id,
        userId: usedUserCoupon.userId,
        orderPrice: 60000,
      });

      expect(result.isValid).toBe(false);
      expect(result.discountPrice).toBe(0);
      expect(result.discountedPrice).toBe(60000); // 원래 주문 금액 그대로
    });
  });

  describe("에러 케이스", () => {
    it("존재하지 않는 쿠폰 ID로 요청시 에러가 발생해야 한다", async () => {
      const nonExistentCouponId = uuidv4();
      couponRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          couponId: nonExistentCouponId,
          userId: uuidv4(),
          orderPrice: 10000,
        })
      ).rejects.toThrow(CouponNotFoundError);
    });
  });
});
