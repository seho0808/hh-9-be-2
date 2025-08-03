import { Injectable } from "@nestjs/common";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";

export interface ValidateCouponCommand {
  userCouponId: string;
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
    const { userCouponId, orderPrice } = command;

    const userCoupon = await this.userCouponRepository.findById(userCouponId);
    if (!userCoupon) {
      throw new CouponNotFoundError(userCouponId);
    }

    const coupon = await this.couponRepository.findById(userCoupon.couponId);
    if (!coupon) {
      throw new CouponNotFoundError(userCoupon.couponId);
    }

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
