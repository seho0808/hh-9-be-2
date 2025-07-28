import { Injectable, Inject } from "@nestjs/common";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { ValidateUserCouponDomainService } from "@/coupon/domain/services/validate-user-coupon.service";

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
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface,
    private readonly validateUserCouponDomainService: ValidateUserCouponDomainService
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

    const { isValid, discountPrice, discountedPrice } =
      await this.validateUserCouponDomainService.validateUserCoupon({
        coupon,
        userCoupon,
        orderPrice,
      });

    return {
      isValid,
      discountPrice,
      discountedPrice,
    };
  }
}
