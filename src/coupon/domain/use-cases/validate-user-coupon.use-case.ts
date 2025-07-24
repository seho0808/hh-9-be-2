import { Injectable, Inject } from "@nestjs/common";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { CouponNotFoundError } from "../exceptions/coupon.exceptions";

export interface ValidateCouponCommand {
  couponId: string;
  userId: string;
  orderPrice: number;
}

export interface ValidateCouponResult {
  isValid: boolean;
  discountPrice: number;
}

@Injectable()
export class ValidateCouponUseCase {
  constructor(
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface
  ) {}

  async execute(command: ValidateCouponCommand): Promise<ValidateCouponResult> {
    const { couponId, userId, orderPrice } = command;

    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    const userCoupon = await this.userCouponRepository.findByCouponIdAndUserId(
      couponId,
      userId
    );

    if (!coupon.canUse(orderPrice)) {
      return {
        isValid: false,
        discountPrice: 0,
      };
    }

    if (!userCoupon.canUse()) {
      return {
        isValid: false,
        discountPrice: 0,
      };
    }

    const { discountPrice } = coupon.use(orderPrice);

    return {
      isValid: true,
      discountPrice,
    };
  }
}
