import { Injectable } from "@nestjs/common";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { PubSubLockService } from "@/common/infrastructure/locks/pubsub-lock.service";
import { IssueUserCouponUseCase } from "../tier-1-in-domain/issue-user-coupon.use-case";

export interface IssueUserCouponWithPubSubLockCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

export interface IssueUserCouponWithPubSubLockResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponWithPubSubLockUseCase {
  constructor(
    private readonly pubSubLockService: PubSubLockService,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase
  ) {}

  async execute(
    command: IssueUserCouponWithPubSubLockCommand
  ): Promise<IssueUserCouponWithPubSubLockResult> {
    const lockKey = `pubsub:coupon:issue:${command.couponId}`;

    return await this.pubSubLockService.withLock(lockKey, async () => {
      return await this.issueUserCouponUseCase.execute(command);
    });
  }
}
