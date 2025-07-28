import { Module } from "@nestjs/common";
import { CouponController } from "./infrastructure/http/coupon.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionService } from "../common/services/transaction.service";
import { UserCouponController } from "./infrastructure/http/user-coupon.controller";
import { CouponApplicationService } from "./application/services/coupon.service";
import { GetAllCouponsUseCase } from "./application/use-cases/tier-1-in-domain/get-all-coupons.use-case";
import { UserCouponUseCase } from "./application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { GetAllUserCouponsUseCase } from "./application/use-cases/tier-1-in-domain/get-all-user-couponse.use-case";
import { GetCouponByIdUseCase } from "./application/use-cases/tier-1-in-domain/get-coupon-by-id.use-case";
import { IssueUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { ValidateCouponUseCase } from "./application/use-cases/tier-1-in-domain/validate-user-coupon.use-case";
import { CancelUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/cancel-user-coupon.use-case";
import { UserCouponRepository } from "./infrastructure/persistence/user-coupon.repository";
import { CouponRepository } from "./infrastructure/persistence/coupon.repository";
import { CouponTypeOrmEntity } from "./infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "./infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecoverUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { UseUserCouponDomainService } from "./domain/services/use-user-coupon.service";
import { ValidateUserCouponDomainService } from "./domain/services/validate-user-coupon.service";
import { CancelUserCouponDomainService } from "./domain/services/cancel-user-coupon.service";
import { IssueUserCouponDomainService } from "./domain/services/issue-user-coupon.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserCouponTypeOrmEntity, CouponTypeOrmEntity]),
    AuthModule,
  ],
  controllers: [CouponController, UserCouponController],
  providers: [
    TransactionService,
    CouponApplicationService,
    GetAllCouponsUseCase,
    GetAllUserCouponsUseCase,
    GetCouponByIdUseCase,
    IssueUserCouponUseCase,
    UserCouponUseCase,
    ValidateCouponUseCase,
    CancelUserCouponUseCase,
    RecoverUserCouponUseCase,
    CancelUserCouponDomainService,
    UseUserCouponDomainService,
    ValidateUserCouponDomainService,
    IssueUserCouponDomainService,
    {
      provide: "UserCouponRepositoryInterface",
      useClass: UserCouponRepository,
    },
    {
      provide: "CouponRepositoryInterface",
      useClass: CouponRepository,
    },
  ],
  exports: [CouponApplicationService],
})
export class CouponModule {}
