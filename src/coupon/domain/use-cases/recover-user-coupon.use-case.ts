import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { UserCouponNotFoundError } from "@/coupon/domain/exceptions/user-coupon.exception";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { Inject, Injectable } from "@nestjs/common";

export interface RecoverUserCouponCommand {
  userCouponId: string;
  idempotencyKey: string;
}

export interface RecoverUserCouponResult {
  userCoupon: UserCoupon;
}

@Injectable()
export class RecoverUserCouponUseCase {
  constructor(
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface
  ) {}

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
