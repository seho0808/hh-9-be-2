import { Test } from "@nestjs/testing";
import { RecoverUserCouponUseCase } from "./recover-user-coupon.use-case";
import {
  UserCouponNotFoundError,
  UserCouponRecoverIdempotencyKeyMismatchError,
} from "@/coupon/domain/exceptions/user-coupon.exception";
import {
  UserCoupon,
  UserCouponStatus,
} from "@/coupon/domain/entities/user-coupon.entity";
import { v4 as uuidv4 } from "uuid";

describe("RecoverUserCouponUseCase", () => {
  let useCase: RecoverUserCouponUseCase;
  let userCouponRepository: any;

  beforeEach(async () => {
    userCouponRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RecoverUserCouponUseCase,
        {
          provide: "UserCouponRepositoryInterface",
          useValue: userCouponRepository,
        },
      ],
    }).compile();

    useCase = module.get<RecoverUserCouponUseCase>(RecoverUserCouponUseCase);
  });

  describe("쿠폰 복구 성공 케이스", () => {
    it("사용된 쿠폰이 정상적으로 복구되어야 한다", async () => {
      const userCoupon = UserCoupon.create({
        couponId: uuidv4(),
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      const orderId = uuidv4();
      const discountPrice = 10000;
      const usedIdempotencyKey = uuidv4();

      // 쿠폰을 사용된 상태로 만들기
      userCoupon.use(orderId, discountPrice, usedIdempotencyKey);

      userCouponRepository.findById.mockResolvedValue(userCoupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
        idempotencyKey: usedIdempotencyKey,
      });

      expect(result.userCoupon.status).toBe(UserCouponStatus.ISSUED);
      expect(result.userCoupon.orderId).toBeNull();
      expect(result.userCoupon.discountPrice).toBeNull();
      expect(result.userCoupon.usedAt).toBeNull();
    });

    it("사용되지 않은 쿠폰으로 복구 요청시 아무것도 하지 않고 성공해야 한다", async () => {
      const userCoupon = UserCoupon.create({
        couponId: uuidv4(),
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      const originalStatus = userCoupon.status;

      userCouponRepository.findById.mockResolvedValue(userCoupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
        idempotencyKey: uuidv4(),
      });

      expect(result.userCoupon.status).toBe(originalStatus);
      expect(result.userCoupon.orderId).toBeNull();
      expect(result.userCoupon.discountPrice).toBeNull();
      expect(result.userCoupon.usedAt).toBeNull();
    });

    it("취소된 쿠폰으로 복구 요청시 아무것도 하지 않고 성공해야 한다", async () => {
      const userCoupon = UserCoupon.create({
        couponId: uuidv4(),
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      userCoupon.cancel();
      const originalStatus = userCoupon.status;

      userCouponRepository.findById.mockResolvedValue(userCoupon);

      const result = await useCase.execute({
        userCouponId: userCoupon.id,
        idempotencyKey: uuidv4(),
      });

      expect(result.userCoupon.status).toBe(originalStatus);
      expect(result.userCoupon.cancelledAt).toBeDefined();
    });
  });

  describe("쿠폰 복구 실패 케이스", () => {
    it("존재하지 않는 사용자 쿠폰 ID로 요청시 에러가 발생해야 한다", async () => {
      const nonExistentUserCouponId = uuidv4();
      userCouponRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userCouponId: nonExistentUserCouponId,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow(UserCouponNotFoundError);
    });

    it("잘못된 idempotencyKey로 요청시 에러가 발생해야 한다", async () => {
      const userCoupon = UserCoupon.create({
        couponId: uuidv4(),
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      const orderId = uuidv4();
      const discountPrice = 10000;
      const correctIdempotencyKey = uuidv4();
      const wrongIdempotencyKey = uuidv4();

      // 쿠폰을 사용된 상태로 만들기
      userCoupon.use(orderId, discountPrice, correctIdempotencyKey);

      userCouponRepository.findById.mockResolvedValue(userCoupon);

      await expect(
        useCase.execute({
          userCouponId: userCoupon.id,
          idempotencyKey: wrongIdempotencyKey, // 잘못된 키 사용
        })
      ).rejects.toThrow(UserCouponRecoverIdempotencyKeyMismatchError);
    });

    it("동일한 idempotencyKey로 여러 번 복구 요청시 정상적으로 처리되어야 한다", async () => {
      const userCoupon = UserCoupon.create({
        couponId: uuidv4(),
        userId: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issuedIdempotencyKey: uuidv4(),
      });

      const orderId = uuidv4();
      const discountPrice = 10000;
      const usedIdempotencyKey = uuidv4();

      // 쿠폰을 사용된 상태로 만들기
      userCoupon.use(orderId, discountPrice, usedIdempotencyKey);

      userCouponRepository.findById.mockResolvedValue(userCoupon);

      // 첫 번째 복구
      const firstResult = await useCase.execute({
        userCouponId: userCoupon.id,
        idempotencyKey: usedIdempotencyKey,
      });

      expect(firstResult.userCoupon.status).toBe(UserCouponStatus.ISSUED);

      // 두 번째 복구 (이미 복구된 상태)
      const secondResult = await useCase.execute({
        userCouponId: userCoupon.id,
        idempotencyKey: usedIdempotencyKey,
      });

      expect(secondResult.userCoupon.status).toBe(UserCouponStatus.ISSUED);
    });
  });
});
