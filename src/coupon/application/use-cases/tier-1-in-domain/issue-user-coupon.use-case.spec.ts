import { Test } from "@nestjs/testing";
import { IssueUserCouponUseCase } from "./issue-user-coupon.use-case";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import {
  CouponExhaustedError,
  CouponExpiredError,
  InvalidCouponCodeError,
} from "@/coupon/domain/exceptions/coupon.exceptions";
import {
  Coupon,
  CouponDiscountType,
} from "@/coupon/domain/entities/coupon.entity";
import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { v4 as uuidv4 } from "uuid";

jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

describe("IssueUserCouponUseCase", () => {
  let useCase: IssueUserCouponUseCase;
  let couponRepository: any;
  let userCouponRepository: any;

  beforeEach(async () => {
    couponRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    userCouponRepository = {
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        IssueUserCouponUseCase,
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

    useCase = module.get<IssueUserCouponUseCase>(IssueUserCouponUseCase);
  });

  describe("쿠폰 발급 성공 케이스", () => {
    it("유효한 쿠폰 코드로 요청시 사용자 쿠폰이 정상 발급되어야 한다", async () => {
      const coupon = Coupon.create({
        name: "테스트 쿠폰",
        description: "테스트용 쿠폰",
        couponCode: "TEST123",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expiresInDays: 7,
      });

      couponRepository.findById.mockResolvedValue(coupon);

      const userId = uuidv4();
      const result = await useCase.execute({
        couponId: coupon.id,
        userId,
        couponCode: "TEST123",
        idempotencyKey: uuidv4(),
      });

      expect(result.coupon).toBe(coupon);
      expect(result.userCoupon).toBeInstanceOf(UserCoupon);
      expect(result.userCoupon.userId).toBe(userId);
      expect(result.userCoupon.couponId).toBe(coupon.id);
      expect(result.userCoupon.status).toBe(UserCouponStatus.ISSUED);
    });

    it("발급된 쿠폰의 만료일이 쿠폰의 종료일과 동일해도 정상 발급되어야 한다", async () => {
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const coupon = Coupon.create({
        name: "만료일 테스트 쿠폰",
        description: "만료일 테스트",
        couponCode: "EXPIRE123",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(),
        endDate,
        expiresInDays: 7,
      });

      couponRepository.findById.mockResolvedValue(coupon);

      const result = await useCase.execute({
        couponId: coupon.id,
        userId: uuidv4(),
        couponCode: "EXPIRE123",
        idempotencyKey: uuidv4(),
      });

      expect(result.userCoupon.expiresAt).toEqual(endDate);
    });
  });

  describe("쿠폰 발급 실패 케이스", () => {
    it("존재하지 않는 쿠폰 ID로 요청시 에러가 발생해야 한다", async () => {
      const nonExistentCouponId = uuidv4();
      couponRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          couponId: nonExistentCouponId,
          userId: uuidv4(),
          couponCode: "TEST123",
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(CouponNotFoundError);
    });

    it("잘못된 쿠폰 코드로 요청시 에러가 발생해야 한다", async () => {
      const coupon = Coupon.create({
        name: "테스트 쿠폰",
        description: "테스트용 쿠폰",
        couponCode: "CORRECT123",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expiresInDays: 7,
      });

      couponRepository.findById.mockResolvedValue(coupon);

      await expect(
        useCase.execute({
          couponId: coupon.id,
          userId: uuidv4(),
          couponCode: "WRONG123",
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(InvalidCouponCodeError);
    });

    it("만료된 쿠폰으로 요청시 에러가 발생해야 한다", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const coupon = Coupon.create({
        name: "만료 쿠폰",
        description: "만료된 쿠폰",
        couponCode: "EXPIRED123",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 100,
        startDate: new Date(pastDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: pastDate,
        expiresInDays: 7,
      });

      couponRepository.findById.mockResolvedValue(coupon);

      await expect(
        useCase.execute({
          couponId: coupon.id,
          userId: uuidv4(),
          couponCode: "EXPIRED123",
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(CouponExpiredError);
    });

    it("발급 가능 수량을 초과한 쿠폰으로 요청시 에러가 발생해야 한다", async () => {
      const coupon = Coupon.create({
        name: "수량 제한 쿠폰",
        description: "수량 제한 테스트",
        couponCode: "LIMITED123",
        discountType: CouponDiscountType.FIXED,
        discountValue: 10000,
        minimumOrderPrice: 50000,
        maxDiscountPrice: null,
        totalCount: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expiresInDays: 7,
      });

      // 수량 제한에 도달하도록 발급
      coupon.issue("LIMITED123");

      couponRepository.findById.mockResolvedValue(coupon);

      await expect(
        useCase.execute({
          couponId: coupon.id,
          userId: uuidv4(),
          couponCode: "LIMITED123",
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(CouponExhaustedError);
    });
  });
});
