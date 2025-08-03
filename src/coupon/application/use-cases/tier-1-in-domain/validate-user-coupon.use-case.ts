import { Injectable } from "@nestjs/common";
import { CouponNotFoundError } from "@/coupon/application/coupon.application.exceptions";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface ValidateCouponCommand {
  couponId: string;
  userId: string;
  orderPrice: number;
}

export interface ValidateCouponResult {
  isValid: boolean;
  discountPrice: number;
  discountedPrice: number;
}

@Injectable()
export class ValidateCouponUseCase {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly userCouponRepository: UserCouponRepository,
    private readonly validateUserCouponService: ValidateUserCouponService
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

    const isValid = this.validateUserCouponService.validateUserCoupon({
      coupon,
      userCoupon,
      orderPrice,
    });

    if (!isValid) {
      return {
        isValid: false,
        discountPrice: 0,
        discountedPrice: orderPrice,
      };
    }

    const { discountPrice, discountedPrice } = coupon.use(orderPrice);

    return {
      isValid: true,
      discountPrice,
      discountedPrice,
    };
  }
}
