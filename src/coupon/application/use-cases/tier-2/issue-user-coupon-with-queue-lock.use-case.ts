import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { QueueLockService } from "@/common/infrastructure/locks/queue-lock.service";
import { IssueUserCouponUseCase } from "../tier-1-in-domain/issue-user-coupon.use-case";

export interface IssueUserCouponWithQueueLockCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

export interface IssueUserCouponWithQueueLockResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponWithQueueLockUseCase {
  constructor(
    private readonly queueLockService: QueueLockService,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase
  ) {}

  async execute(
    command: IssueUserCouponWithQueueLockCommand
  ): Promise<IssueUserCouponWithQueueLockResult> {
    const lockKey = `queue:coupon:issue:${command.couponId}`;

    return await this.queueLockService.withLock(lockKey, async () => {
      return await this.issueUserCouponUseCase.execute(command);
    });
  }
}
