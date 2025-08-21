import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

import {
  CouponNotFoundError,
  DuplicateIdempotencyKeyError,
} from "@/coupon/application/coupon.application.exceptions";
import { CouponRedisRepository } from "@/coupon/infrastructure/persistence/coupon-redis.repository";
import { CouponExhaustedError } from "@/coupon/domain/exceptions/coupon.exceptions";

export interface IssueUserCouponWithRedisCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

export interface IssueUserCouponWithRedisResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponWithRedisUseCase {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly userCouponRepository: UserCouponRepository,
    private readonly couponRedisRepository: CouponRedisRepository
  ) {}

  async execute(
    command: IssueUserCouponWithRedisCommand
  ): Promise<IssueUserCouponWithRedisResult> {
    const { couponId, userId, couponCode, idempotencyKey } = command;

    // 1. 기본 검증
    await this.validateIdempotencyKey(idempotencyKey);
    const coupon = await this.findAndValidateCoupon(couponId);
    const existingUserCoupon = await this.findExistingUserCoupon(
      couponId,
      userId
    );

    // 2. Redis에서 발급 가능 여부 확인 및 원자적 감소 (countdown 방식)
    const issuanceCheck =
      await this.couponRedisRepository.checkAndDecrementRemainingCount(
        couponId,
        coupon.totalCount
      );

    if (!issuanceCheck.success) {
      throw new CouponExhaustedError(couponId);
    }

    try {
      // 3. 도메인 비즈니스 로직 실행 (Redis 체크는 이미 완료됨)
      coupon.issue(couponCode, existingUserCoupon);
      const userCoupon = UserCoupon.create({
        couponId: coupon.id,
        userId,
        expiresAt: coupon.endDate,
        issuedIdempotencyKey: idempotencyKey,
      });

      // 4. DB에 userCoupon 저장 (insert만 수행하므로 락 경합 없음)
      await this.userCouponRepository.save(userCoupon);

      return { coupon, userCoupon };
    } catch (error) {
      // 5. DB 저장 실패 시 Redis 롤백
      try {
        await this.couponRedisRepository.rollbackRemainingCount(couponId);
      } catch (rollbackError) {
        console.error("Redis rollback failed", rollbackError); // TODO: logger 적용
      }

      throw error;
    }
  }

  private async validateIdempotencyKey(idempotencyKey: string): Promise<void> {
    const existingUserCoupon =
      await this.userCouponRepository.findByIdempotencyKey(idempotencyKey);
    if (existingUserCoupon) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey);
    }
  }

  private async findAndValidateCoupon(couponId: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }
    return coupon;
  }

  private async findExistingUserCoupon(
    couponId: string,
    userId: string
  ): Promise<UserCoupon | null> {
    return this.userCouponRepository.findByCouponIdAndUserId(couponId, userId);
  }
}
