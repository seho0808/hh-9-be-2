import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import {
  CouponNotFoundError,
  DuplicateIdempotencyKeyError,
} from "@/coupon/application/coupon.application.exceptions";
import { Transactional } from "typeorm-transactional";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface IssueUserCouponCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

export interface IssueUserCouponResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponUseCase {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly userCouponRepository: UserCouponRepository
  ) {}

  @Transactional()
  async execute(
    command: IssueUserCouponCommand
  ): Promise<IssueUserCouponResult> {
    const { couponId, userId, couponCode, idempotencyKey } = command;

    const idempotencyKeyObj =
      await this.userCouponRepository.findByIdempotencyKey(idempotencyKey);
    if (idempotencyKeyObj) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey);
    }

    // 데드락 방지를 위해 coupon => userCoupon 순으로 타 유스케이스와 조회 순서 동일
    const coupon = await this.couponRepository.findByIdWithLock(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    const existingUserCoupon =
      await this.userCouponRepository.findByCouponIdAndUserIdWithLock(
        couponId,
        userId
      );

    coupon.issue(couponCode, existingUserCoupon);
    const userCoupon = UserCoupon.create({
      couponId: coupon.id,
      userId,
      expiresAt: coupon.endDate,
      issuedIdempotencyKey: idempotencyKey,
    });

    await Promise.all([
      this.couponRepository.save(coupon),
      this.userCouponRepository.save(userCoupon),
    ]);

    return {
      coupon,
      userCoupon,
    };
  }
}
