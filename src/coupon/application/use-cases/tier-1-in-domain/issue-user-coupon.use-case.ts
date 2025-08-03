import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { DuplicateIdempotencyKeyError } from "@/coupon/domain/exceptions/user-coupon.exception";
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

    const existingUserCoupon =
      await this.userCouponRepository.findByIdempotencyKey(idempotencyKey);
    if (existingUserCoupon) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey);
    }

    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    coupon.issue(couponCode);
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
