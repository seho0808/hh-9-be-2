import { Injectable } from "@nestjs/common";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface GetAllUserCouponsCommand {
  userId: string;
}

export interface GetAllUserCouponsResult {
  userCoupons: UserCoupon[];
}

@Injectable()
export class GetAllUserCouponsUseCase {
  constructor(private readonly userCouponRepository: UserCouponRepository) {}

  async execute(
    command: GetAllUserCouponsCommand
  ): Promise<GetAllUserCouponsResult> {
    const { userId } = command;

    const userCoupons = await this.userCouponRepository.findByUserId(userId);

    return {
      userCoupons,
    };
  }
}
