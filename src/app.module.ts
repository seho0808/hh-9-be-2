import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./common/infrastructure/config/database.module";
import { RedisModule } from "./common/infrastructure/config/redis.module";
import { KafkaModule } from "./common/infrastructure/config/kafka.module";
import { OutboxModule } from "./common/infrastructure/messaging/outbox.module";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { ProductModule } from "./product/product.module";
import { WalletModule } from "./wallet/wallet.module";
import { CouponModule } from "./coupon/coupon.module";
import { OrderModule } from "./order/order.module";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    RedisModule,
    KafkaModule,
    DatabaseModule,
    OutboxModule,
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
