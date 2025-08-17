import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { RedlockSpinLockService } from "@/common/infrastructure/locks/redlock-spin-lock.service";
import { IssueUserCouponUseCase } from "../tier-1-in-domain/issue-user-coupon.use-case";

export interface IssueUserCouponWithRedlockSpinLockCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

export interface IssueUserCouponWithRedlockSpinLockResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponWithRedlockSpinLockUseCase {
  constructor(
    private readonly redlockSpinLockService: RedlockSpinLockService,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase
  ) {}

  async execute(
    command: IssueUserCouponWithRedlockSpinLockCommand
  ): Promise<IssueUserCouponWithRedlockSpinLockResult> {
    const lockKey = `redlock:coupon:issue:${command.couponId}`;

    return await this.redlockSpinLockService.withLock(lockKey, async () => {
      return await this.issueUserCouponUseCase.execute(command);
    });
  }
}
