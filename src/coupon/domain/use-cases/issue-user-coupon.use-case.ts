import { Injectable, Inject } from "@nestjs/common";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { CouponNotFoundError } from "../exceptions/coupon.exceptions";

export interface IssueUserCouponCommand {
  couponId: string;
  userId: string;
  couponCode: string;
}

export interface IssueUserCouponResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
}

@Injectable()
export class IssueUserCouponUseCase {
  constructor(
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface
  ) {}

  async execute(
    command: IssueUserCouponCommand
  ): Promise<IssueUserCouponResult> {
    const { couponId, userId, couponCode } = command;

    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    coupon.issue(couponCode);

    const userCoupon = UserCoupon.create({
      couponId,
      userId,
      expiresAt: coupon.endDate,
    });

    await Promise.all([
      this.couponRepository.save(coupon),
      this.userCouponRepository.save(userCoupon),
    ]);

    return {
      coupon,
      userCoupon,
    };
  }
}
