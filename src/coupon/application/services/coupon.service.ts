import { Injectable } from "@nestjs/common";
import { GetAllCouponsUseCase } from "@/coupon/domain/use-cases/get-all-coupons.use-case";
import { GetAllUserCouponsUseCase } from "@/coupon/domain/use-cases/get-all-user-couponse.use-case";
import { IssueUserCouponUseCase } from "@/coupon/domain/use-cases/issue-user-coupon.use-case";
import { UserCouponUseCase } from "@/coupon/domain/use-cases/use-user-coupon.use-case";
import { ValidateCouponUseCase } from "@/coupon/domain/use-cases/validate-user-coupon.use-case";
import { CancelUserCouponUseCase } from "@/coupon/domain/use-cases/cancel-user-coupon.use-case";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { GetCouponByIdUseCase } from "@/coupon/domain/use-cases/get-coupon-by-id.use-case";

@Injectable()
export class CouponApplicationService {
  constructor(
    private readonly getAllCouponsUseCase: GetAllCouponsUseCase,
    private readonly getAllUserCouponsUseCase: GetAllUserCouponsUseCase,
    private readonly getCouponByIdUseCase: GetCouponByIdUseCase,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase,
    private readonly useUserCouponUseCase: UserCouponUseCase,
    private readonly validateCouponUseCase: ValidateCouponUseCase,
    private readonly cancelUserCouponUseCase: CancelUserCouponUseCase
  ) {}

  async getAllCoupons(): Promise<Coupon[]> {
    const result = await this.getAllCouponsUseCase.execute();

    return result.coupons;
  }

  async getAllUserCoupons(userId: string): Promise<UserCoupon[]> {
    const result = await this.getAllUserCouponsUseCase.execute({
      userId,
    });

    return result.userCoupons;
  }

  async getCouponById(couponId: string): Promise<Coupon> {
    const result = await this.getCouponByIdUseCase.execute({ couponId });

    return result.coupon;
  }

  async issueUserCoupon({
    couponId,
    userId,
    couponCode,
  }: {
    couponId: string;
    userId: string;
    couponCode: string;
  }): Promise<UserCoupon> {
    const result = await this.issueUserCouponUseCase.execute({
      couponId,
      userId,
      couponCode,
    });

    return result.userCoupon;
  }

  async useUserCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    orderPrice: number
  ): Promise<UserCoupon> {
    const result = await this.useUserCouponUseCase.execute({
      couponId,
      userId,
      orderId,
      orderPrice,
    });

    return result.userCoupon;
  }

  async validateUserCoupon(
    couponId: string,
    userId: string,
    orderPrice: number
  ): Promise<{
    isValid: boolean;
    discountPrice: number;
  }> {
    const result = await this.validateCouponUseCase.execute({
      couponId,
      userId,
      orderPrice,
    });

    return {
      isValid: result.isValid,
      discountPrice: result.discountPrice,
    };
  }

  async cancelUserCoupon(userCouponId: string): Promise<UserCoupon> {
    const result = await this.cancelUserCouponUseCase.execute({
      userCouponId,
    });

    return result.userCoupon;
  }
}
