import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { SpinLockService } from "@/common/infrastructure/locks/spin-lock.service";
import { IssueUserCouponUseCase } from "../tier-1-in-domain/issue-user-coupon.use-case";

export interface IssueUserCouponWithSpinLockCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
  lockStrategy: "spinlock" | "both";
}

export interface IssueUserCouponWithSpinLockResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponWithSpinLockUseCase {
  constructor(
    private readonly spinLockService: SpinLockService,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase
  ) {}

  async execute(
    command: IssueUserCouponWithSpinLockCommand
  ): Promise<IssueUserCouponWithSpinLockResult> {
    const lockKey = `spinlock:coupon:issue:${command.couponId}`;

    return await this.spinLockService.withLock(lockKey, async () => {
      return await this.issueUserCouponUseCase.execute({
        ...command,
        lockStrategy: command.lockStrategy === "both" ? "db-lock" : "no-lock",
      });
    });
  }
}
