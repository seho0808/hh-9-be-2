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
import { FencingTokenViolationError } from "@/common/infrastructure/infrastructure.exceptions";

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
    return this.executeInternal(command);
  }

  /**
   * Fencing token과 함께 쿠폰 발급 (CAS 방식)
   */
  @Transactional()
  async executeWithFencingToken(
    command: IssueUserCouponCommand,
    fencingToken: number
  ): Promise<IssueUserCouponResult> {
    return this.executeInternal(command, fencingToken);
  }

  private async executeInternal(
    command: IssueUserCouponCommand,
    fencingToken?: number
  ): Promise<IssueUserCouponResult> {
    const { couponId, userId, couponCode, idempotencyKey } = command;

    // 1. 공통 검증 로직
    await this.validateIdempotencyKey(idempotencyKey);
    const coupon = await this.findAndValidateCoupon(couponId);
    const existingUserCoupon = await this.findExistingUserCoupon(
      couponId,
      userId
    );

    // 2. 비즈니스 로직 실행
    coupon.issue(couponCode, existingUserCoupon);
    const userCoupon = UserCoupon.create({
      couponId: coupon.id,
      userId,
      expiresAt: coupon.endDate,
      issuedIdempotencyKey: idempotencyKey,
    });

    // 3. 저장 로직 (fencing token 유무에 따라 분기)
    if (fencingToken !== undefined) {
      await this.saveCouponWithFencingToken(
        couponId,
        fencingToken,
        coupon.issuedCount
      );
      await this.userCouponRepository.save(userCoupon);
    } else {
      await Promise.all([
        this.couponRepository.save(coupon),
        this.userCouponRepository.save(userCoupon),
      ]);
    }

    return { coupon, userCoupon };
  }

  private async validateIdempotencyKey(idempotencyKey: string): Promise<void> {
    const existingKey =
      await this.userCouponRepository.findByIdempotencyKey(idempotencyKey);
    if (existingKey) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey);
    }
  }

  private async findAndValidateCoupon(couponId: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findByIdWithLock(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }
    return coupon;
  }

  private async findExistingUserCoupon(
    couponId: string,
    userId: string
  ): Promise<UserCoupon | null> {
    return this.userCouponRepository.findByCouponIdAndUserIdWithLock(
      couponId,
      userId
    );
  }

  private async saveCouponWithFencingToken(
    couponId: string,
    fencingToken: number,
    issuedCount: number
  ): Promise<void> {
    const updateSuccess = await this.couponRepository.updateWithFencingToken(
      couponId,
      fencingToken,
      { issuedCount }
    );

    if (!updateSuccess) {
      throw new FencingTokenViolationError(fencingToken, -1);
    }
  }
}
