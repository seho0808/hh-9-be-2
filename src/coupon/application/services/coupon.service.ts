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
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepository,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepository,
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
    idempotencyKey,
    parentManager,
  }: {
    couponId: string;
    userId: string;
    couponCode: string;
    idempotencyKey: string;
    parentManager?: EntityManager;
  }): Promise<UserCoupon> {
    return await this.executeInTransaction(async () => {
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
    return await this.executeInTransaction(async () => {
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
    const result = await this.validateCouponUseCase.execute({
      couponId,
      userId,
      orderPrice,
    });

    return {
      isValid: result.isValid,
      discountPrice: result.discountPrice,
      discountedPrice: result.discountedPrice,
    };
  }

  async cancelUserCoupon(userCouponId: string): Promise<UserCoupon> {
    return await this.executeInTransaction(async () => {
      const result = await this.cancelUserCouponUseCase.execute({
        userCouponId,
      });
      return result.userCoupon;
    });
  }

  async recoverUserCoupon(
    userCouponId: string,
    idempotencyKey: string,
    parentManager?: EntityManager
  ): Promise<UserCoupon> {
    return await this.executeInTransaction(async () => {
      const result = await this.recoverUserCouponUseCase.execute({
        userCouponId,
        idempotencyKey,
      });
      return result.userCoupon;
    }, parentManager);
  }

  private async executeInTransaction<T>(
    operation: (manager?: EntityManager) => Promise<T>,
    parentManager?: EntityManager
  ): Promise<T> {
    const repositories = [this.couponRepository, this.userCouponRepository];

    return await this.transactionService.executeInTransaction(
      repositories,
      operation,
      parentManager
    );
  }
}
