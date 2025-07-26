import { Injectable, Inject } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { GetAllCouponsUseCase } from "@/coupon/domain/use-cases/get-all-coupons.use-case";
import { GetAllUserCouponsUseCase } from "@/coupon/domain/use-cases/get-all-user-couponse.use-case";
import { IssueUserCouponUseCase } from "@/coupon/domain/use-cases/issue-user-coupon.use-case";
import { UserCouponUseCase } from "@/coupon/domain/use-cases/use-user-coupon.use-case";
import { ValidateCouponUseCase } from "@/coupon/domain/use-cases/validate-user-coupon.use-case";
import { CancelUserCouponUseCase } from "@/coupon/domain/use-cases/cancel-user-coupon.use-case";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { GetCouponByIdUseCase } from "@/coupon/domain/use-cases/get-coupon-by-id.use-case";
import { RecoverUserCouponUseCase } from "@/coupon/domain/use-cases/recover-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { TransactionService } from "@/common/services/transaction.service";

@Injectable()
export class CouponApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly getAllCouponsUseCase: GetAllCouponsUseCase,
    private readonly getAllUserCouponsUseCase: GetAllUserCouponsUseCase,
    private readonly getCouponByIdUseCase: GetCouponByIdUseCase,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase,
    private readonly useUserCouponUseCase: UserCouponUseCase,
    private readonly validateCouponUseCase: ValidateCouponUseCase,
    private readonly cancelUserCouponUseCase: CancelUserCouponUseCase,
    private readonly recoverUserCouponUseCase: RecoverUserCouponUseCase
  ) {}

  async getAllCoupons(): Promise<Coupon[]> {
    const result = await this.getAllCouponsUseCase.execute();
    return result.coupons;
  }

  async getCouponById(id: string): Promise<Coupon | null> {
    const result = await this.getCouponByIdUseCase.execute({ couponId: id });
    return result.coupon;
  }

  async getAllUserCoupons(userId: string): Promise<UserCoupon[]> {
    const result = await this.getAllUserCouponsUseCase.execute({ userId });
    return result.userCoupons;
  }

  async issueUserCoupon({
    couponId,
    userId,
    couponCode,
    idempotencyKey,
    parentManager,
  }: {
    couponId: string;
    userId: string;
    couponCode: string;
    idempotencyKey: string;
    parentManager?: EntityManager;
  }): Promise<UserCoupon> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      const result = await this.issueUserCouponUseCase.execute({
        couponId,
        userId,
        couponCode,
        idempotencyKey,
      });
      return result.userCoupon;
    }, parentManager);
  }

  async useUserCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    orderPrice: number,
    idempotencyKey: string,
    parentManager?: EntityManager
  ): Promise<UserCoupon> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      const result = await this.useUserCouponUseCase.execute({
        couponId,
        userId,
        orderId,
        orderPrice,
        idempotencyKey,
      });
      return result.userCoupon;
    }, parentManager);
  }

  async validateUserCoupon(
    couponId: string,
    userId: string,
    orderPrice: number
  ): Promise<{
    isValid: boolean;
    discountPrice: number;
    discountedPrice: number;
  }> {
    const { isValid, discountPrice, discountedPrice } =
      await this.validateCouponUseCase.execute({
        couponId,
        userId,
        orderPrice,
      });

    return {
      isValid,
      discountPrice,
      discountedPrice,
    };
  }

  async cancelUserCoupon(
    userCouponId: string,
    parentManager?: EntityManager
  ): Promise<UserCoupon> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      const result = await this.cancelUserCouponUseCase.execute({
        userCouponId,
      });
      return result.userCoupon;
    }, parentManager);
  }

  async recoverUserCoupon(
    userCouponId: string,
    idempotencyKey: string,
    parentManager?: EntityManager
  ): Promise<UserCoupon> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      const result = await this.recoverUserCouponUseCase.execute({
        userCouponId,
        idempotencyKey,
      });
      return result.userCoupon;
    }, parentManager);
  }
}
