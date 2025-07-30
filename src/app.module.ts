import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { ProductModule } from "./product/product.module";
import { WalletModule } from "./wallet/wallet.module";
import { CouponModule } from "./coupon/coupon.module";
import { OrderModule } from "./order/order.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // DatabaseModule,
    AuthModule,
    UserModule,
    ProductModule,
    WalletModule,
    CouponModule,
    OrderModule,
  ],
  controllers: [],
})
export class AppModule {}
