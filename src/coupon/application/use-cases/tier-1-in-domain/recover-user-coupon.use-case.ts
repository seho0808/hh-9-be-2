import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { UserCouponNotFoundError } from "@/coupon/domain/exceptions/user-coupon.exception";
import { Injectable } from "@nestjs/common";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface RecoverUserCouponCommand {
  userCouponId: string;
  idempotencyKey: string;
}

export interface RecoverUserCouponResult {
  userCoupon: UserCoupon;
}

@Injectable()
export class RecoverUserCouponUseCase {
  constructor(private readonly userCouponRepository: UserCouponRepository) {}

  async execute(
    command: RecoverUserCouponCommand
  ): Promise<RecoverUserCouponResult> {
    const { userCouponId, idempotencyKey } = command;

    const userCoupon = await this.userCouponRepository.findById(userCouponId);
    if (!userCoupon) {
      throw new UserCouponNotFoundError(userCouponId);
    }

    userCoupon.recover(idempotencyKey);

    await this.userCouponRepository.save(userCoupon);

    return {
      userCoupon,
    };
  }
}
