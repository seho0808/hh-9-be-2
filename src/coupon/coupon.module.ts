import { Module } from "@nestjs/common";
import { CouponController } from "./infrastructure/http/coupon.controller";
import { AuthModule } from "../auth/auth.module";
import { UserCouponController } from "./infrastructure/http/user-coupon.controller";
import { CouponApplicationService } from "./application/services/coupon.service";
import { GetAllCouponsUseCase } from "./domain/use-cases/get-all-coupons.use-case";
import { UserCouponUseCase } from "./domain/use-cases/use-user-coupon.use-case";
import { GetAllUserCouponsUseCase } from "./domain/use-cases/get-all-user-couponse.use-case";
import { GetCouponByIdUseCase } from "./domain/use-cases/get-coupon-by-id.use-case";
import { IssueUserCouponUseCase } from "./domain/use-cases/issue-user-coupon.use-case";
import { ValidateCouponUseCase } from "./domain/use-cases/validate-user-coupon.use-case";
import { CancelUserCouponUseCase } from "./domain/use-cases/cancel-user-coupon.use-case";
import { UserCouponRepository } from "./infrastructure/persistence/user-coupon.repository";
import { CouponRepository } from "./infrastructure/persistence/coupon.repository";
import { CouponTypeOrmEntity } from "./infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "./infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecoverUserCouponUseCase } from "./domain/use-cases/recover-user-coupon.use-case";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserCouponTypeOrmEntity, CouponTypeOrmEntity]),
    AuthModule,
  ],
  controllers: [CouponController, UserCouponController],
  providers: [
    CouponApplicationService,
    GetAllCouponsUseCase,
    GetAllUserCouponsUseCase,
    GetCouponByIdUseCase,
    IssueUserCouponUseCase,
    UserCouponUseCase,
    ValidateCouponUseCase,
    CancelUserCouponUseCase,
    RecoverUserCouponUseCase,
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
