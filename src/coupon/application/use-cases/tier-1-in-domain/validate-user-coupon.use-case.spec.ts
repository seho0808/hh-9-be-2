import { Test } from "@nestjs/testing";
import { ValidateUserCouponUseCase } from "./validate-user-coupon.use-case";
import { CouponNotFoundError } from "@/coupon/application/coupon.application.exceptions";
import {
  Coupon,
  CouponDiscountType,
} from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { v4 as uuidv4 } from "uuid";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";

jest.mock("@/coupon/infrastructure/persistence/coupon.repository");
jest.mock("@/coupon/infrastructure/persistence/user-coupon.repository");
jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

describe("ValidateUserCouponUseCase", () => {
  let useCase: ValidateUserCouponUseCase;
  let couponRepository: jest.Mocked<CouponRepository>;
  let userCouponRepository: jest.Mocked<UserCouponRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ValidateUserCouponUseCase,
        ValidateUserCouponService,
        CouponRepository,
        UserCouponRepository,
      ],
    }).compile();

    useCase = module.get<ValidateUserCouponUseCase>(ValidateUserCouponUseCase);
    couponRepository =
      module.get<jest.Mocked<CouponRepository>>(CouponRepository);
    userCouponRepository =
      module.get<jest.Mocked<UserCouponRepository>>(UserCouponRepository);
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

      userCouponRepository.findById.mockResolvedValue(userCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
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

      userCouponRepository.findById.mockResolvedValue(userCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
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

      userCouponRepository.findById.mockResolvedValue(userCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
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

      userCouponRepository.findById.mockResolvedValue(userCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
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

      userCouponRepository.findById.mockResolvedValue(expiredUserCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: expiredUserCoupon.id,
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

      usedUserCoupon.use("order-1", 10000); // 쿠폰 사용 처리

      userCouponRepository.findById.mockResolvedValue(usedUserCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: usedUserCoupon.id,
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
          userCouponId: nonExistentCouponId,
          orderPrice: 10000,
        })
      ).rejects.toThrow(CouponNotFoundError);
    });
  });
});
