import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { FencingLockService } from "@/common/infrastructure/locks/fencing-lock.service";
import { IssueUserCouponUseCase } from "../tier-1-in-domain/issue-user-coupon.use-case";
import { FencingTokenViolationError } from "@/common/infrastructure/infrastructure.exceptions";

export interface IssueUserCouponWithFencingLockCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

export interface IssueUserCouponWithFencingLockResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponWithFencingLockUseCase {
  constructor(
    private readonly fencingLockService: FencingLockService,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase
  ) {}

  async execute(
    command: IssueUserCouponWithFencingLockCommand
  ): Promise<IssueUserCouponWithFencingLockResult> {
    const lockKey = `fencing:coupon:issue:${command.couponId}`;

    return await this.fencingLockService.withLock(
      lockKey,
      async (fencingToken: number) => {
        return await this.issueUserCouponUseCase.executeWithFencingToken(
          command,
          fencingToken
        );
      }
    );
  }
}
