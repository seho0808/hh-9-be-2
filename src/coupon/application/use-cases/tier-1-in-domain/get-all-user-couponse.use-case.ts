import { Injectable, Inject } from "@nestjs/common";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";

export interface GetAllUserCouponsCommand {
  userId: string;
}

export interface GetAllUserCouponsResult {
  userCoupons: UserCoupon[];
}

@Injectable()
export class GetAllUserCouponsUseCase {
  constructor(
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface
  ) {}

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
