import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { UserCouponNotFoundError } from "@/coupon/application/coupon.application.exceptions";
import { Injectable } from "@nestjs/common";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { Transactional } from "typeorm-transactional";

export interface RecoverUserCouponCommand {
  userCouponId: string;
  orderId: string;
}

export interface RecoverUserCouponResult {
  userCoupon: UserCoupon;
}

@Injectable()
export class RecoverUserCouponUseCase {
  constructor(private readonly userCouponRepository: UserCouponRepository) {}

  @Transactional()
  async execute(
    command: RecoverUserCouponCommand
  ): Promise<RecoverUserCouponResult> {
    const { userCouponId, orderId } = command;

    const userCoupon =
      await this.userCouponRepository.findByIdWithLock(userCouponId);
    if (!userCoupon) {
      throw new UserCouponNotFoundError(userCouponId);
    }

    userCoupon.recover(orderId);

    await this.userCouponRepository.save(userCoupon);

    return {
      userCoupon,
    };
  }
}
