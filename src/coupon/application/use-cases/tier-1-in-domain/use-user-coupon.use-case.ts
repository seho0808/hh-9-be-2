import { Injectable, Inject } from "@nestjs/common";
import { CouponRepositoryInterface } from "@/coupon/domain/interfaces/coupon.repository.interface";
import { UserCouponRepositoryInterface } from "@/coupon/domain/interfaces/user-coupon.repository.interface";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { CouponNotFoundError } from "@/coupon/domain/exceptions/coupon.exceptions";
import { Transactional } from "typeorm-transactional";

export interface UseUserCouponCommand {
  couponId: string;
  userId: string;
  orderId: string;
  orderPrice: number;
  idempotencyKey: string;
}

export interface UseUserCouponResult {
  coupon: Coupon;
  userCoupon: UserCoupon;
  discountPrice: number;
  discountedPrice: number;
}

@Injectable()
export class UseUserCouponUseCase {
  constructor(
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepositoryInterface,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepositoryInterface
  ) {}

  @Transactional()
  async execute(command: UseUserCouponCommand): Promise<UseUserCouponResult> {
    const { couponId, userId, orderId, orderPrice, idempotencyKey } = command;

    const coupon = await this.couponRepository.findById(couponId);
    if (!coupon) {
      throw new CouponNotFoundError(couponId);
    }

    const userCoupon = await this.userCouponRepository.findByCouponIdAndUserId(
      couponId,
      userId
    );

    const { discountPrice, discountedPrice } = coupon.use(orderPrice);
    userCoupon.use(orderId, discountPrice, idempotencyKey);

    await Promise.all([
      this.couponRepository.save(coupon),
      this.userCouponRepository.save(userCoupon),
    ]);

    return {
      coupon,
      userCoupon,
      discountPrice,
      discountedPrice,
    };
  }
}
