import { Test } from "@nestjs/testing";
import { CancelUserCouponUseCase } from "./cancel-user-coupon.use-case";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { UserCouponNotFoundError } from "@/coupon/domain/exceptions/user-coupon.exception";
import {
  Coupon,
  CouponDiscountType,
} from "@/coupon/domain/entities/coupon.entity";
import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { v4 as uuidv4 } from "uuid";

jest.mock("@/coupon/infrastructure/persistence/user-coupon.repository");
jest.mock("@/coupon/infrastructure/persistence/coupon.repository");
jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";

describe("CancelUserCouponUseCase", () => {
  let useCase: CancelUserCouponUseCase;
  let userCouponRepository: jest.Mocked<UserCouponRepository>;
  let couponRepository: jest.Mocked<CouponRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CancelUserCouponUseCase,
        UserCouponRepository,
        CouponRepository,
      ],
    }).compile();

    useCase = module.get<CancelUserCouponUseCase>(CancelUserCouponUseCase);
    userCouponRepository =
      module.get<jest.Mocked<UserCouponRepository>>(UserCouponRepository);
    couponRepository =
      module.get<jest.Mocked<CouponRepository>>(CouponRepository);
  });

  describe("쿠폰 취소 성공 케이스", () => {
    it("발급된 상태의 쿠폰이 정상적으로 취소되어야 한다", async () => {
      const coupon = Coupon.create({
        name: "취소 테스트 쿠폰",
        description: "취소 테스트",
        couponCode: "CANCEL123",
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
      });

      expect(result.userCoupon.status).toBe(UserCouponStatus.CANCELLED);
      expect(result.userCoupon.cancelledAt).toBeDefined();
      expect(result.coupon).toBe(coupon);
    });

    it("사용된 쿠폰이 정상적으로 취소되어야 한다", async () => {
      const coupon = Coupon.create({
        name: "사용됨 취소 테스트 쿠폰",
        description: "사용됨 취소 테스트",
        couponCode: "USECANCEL123",
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

      // NOTE: 다른 유스케이스 가져다가 써야할수도
      const { discountPrice } = coupon.use(50000);
      userCoupon.use("order-1", discountPrice, uuidv4());

      const initialUsedCount = coupon.usedCount;

      userCouponRepository.findById.mockResolvedValue(userCoupon);
      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
      });

      expect(result.userCoupon.status).toBe(UserCouponStatus.CANCELLED);
      expect(result.userCoupon.cancelledAt).toBeDefined();
      expect(result.coupon.usedCount).toBe(initialUsedCount - 1);
    });

    it("이미 취소된 쿠폰으로 요청시 정상적으로 처리되어야한다.", async () => {
      const coupon = Coupon.create({
        name: "이미 취소됨 테스트 쿠폰",
        description: "이미 취소됨 테스트",
        couponCode: "ALREADYCANCEL123",
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

      await useCase.execute({
        userCouponId: userCoupon.id,
      });

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
      });

      expect(result.userCoupon.status).toBe(UserCouponStatus.CANCELLED);
      expect(result.userCoupon.cancelledAt).toBeDefined();
    });
  });

  describe("쿠폰 취소 실패 케이스", () => {
    it("존재하지 않는 사용자 쿠폰 ID로 요청시 에러가 발생해야 한다", async () => {
      const nonExistentUserCouponId = uuidv4();
      userCouponRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userCouponId: nonExistentUserCouponId,
        })
      ).rejects.toThrow(UserCouponNotFoundError);
    });

    it("존재하지 않는 쿠폰으로 요청시 에러가 발생해야 한다", async () => {
      const userCoupon = UserCoupon.create({
        couponId: uuidv4(),
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      userCouponRepository.findById.mockResolvedValue(userCoupon);
      couponRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userCouponId: userCoupon.id,
        })
      ).rejects.toThrow(CouponNotFoundError);
    });
  });
});
