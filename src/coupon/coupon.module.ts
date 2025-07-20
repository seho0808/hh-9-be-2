import { Module } from "@nestjs/common";
import { CouponController, UserCouponController } from "./coupon.controller";
import { CouponMockService } from "./services/coupon.mock.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [CouponController, UserCouponController],
  providers: [CouponMockService],
  exports: [CouponMockService],
})
export class CouponModule {}
