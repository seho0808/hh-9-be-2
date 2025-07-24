import { Module } from "@nestjs/common";
import { OrderController, UserOrderController } from "./order.controller";
import { AuthModule } from "../auth/auth.module";
import { ProductModule } from "../product/product.module";
import { WalletModule } from "../wallet/wallet.module";
import { CouponModule } from "../coupon/coupon.module";

@Module({
  imports: [AuthModule, ProductModule, WalletModule, CouponModule],
  controllers: [OrderController, UserOrderController],
  providers: [],
  exports: [],
})
export class OrderModule {}
