import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LocksModule } from "../common/infrastructure/locks/locks.module";
import { RedisModule } from "../common/infrastructure/config/redis.module";
import { KafkaModule } from "../common/infrastructure/config/kafka.module";
import { CouponController } from "./presentation/http/coupon.controller";
import { UserCouponController } from "./presentation/http/user-coupon.controller";
import { GetAllCouponsUseCase } from "./application/use-cases/tier-1-in-domain/get-all-coupons.use-case";
import { UseUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { GetAllUserCouponsUseCase } from "./application/use-cases/tier-1-in-domain/get-all-user-couponse.use-case";
import { GetCouponByIdUseCase } from "./application/use-cases/tier-1-in-domain/get-coupon-by-id.use-case";
import { IssueUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { IssueUserCouponWithRedisUseCase } from "./application/use-cases/tier-1-in-domain/issue-user-coupon-with-redis.use-case";
import { ValidateUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/validate-user-coupon.use-case";
import { CancelUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/cancel-user-coupon.use-case";
import { UserCouponRepository } from "./infrastructure/persistence/user-coupon.repository";
import { CouponRepository } from "./infrastructure/persistence/coupon.repository";
import { CouponRedisRepository } from "./infrastructure/persistence/coupon-redis.repository";
import { CouponTypeOrmEntity } from "./infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "./infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecoverUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { ValidateUserCouponService } from "./domain/services/validate-user-coupon.service";
import { IssueUserCouponWithSpinLockUseCase } from "./application/use-cases/tier-2/issue-user-coupon-with-spin-lock.use-case";
import { IssueUserCouponWithPubSubLockUseCase } from "./application/use-cases/tier-2/issue-user-coupon-with-pubsub-lock.use-case";
import { IssueUserCouponWithQueueLockUseCase } from "./application/use-cases/tier-2/issue-user-coupon-with-queue-lock.use-case";
import { IssueUserCouponWithFencingLockUseCase } from "./application/use-cases/tier-2/issue-user-coupon-with-fencing-lock.use-case";
import { IssueUserCouponWithRedlockSpinLockUseCase } from "./application/use-cases/tier-2/issue-user-coupon-with-redlock-spin-lock.use-case";
import { IssueUserCouponWithFencingTokenUseCase } from "./application/use-cases/tier-1-in-domain/issue-user-coupon-with-fencing-token.use-case";
import { OutboxRepository } from "@/common/infrastructure/persistence/outbox.repository";
import { OutboxTypeOrmEntity } from "@/common/infrastructure/persistence/orm/outbox.typeorm.entity";
import { ReserveIssueUserCouponUseCase } from "./application/use-cases/tier-1-in-domain/reserve-issue-user-coupon.use-case";
import { CouponReservationRepository } from "./infrastructure/persistence/coupon-reservation.repository";
import { CouponReservationTypeOrmEntity } from "./infrastructure/persistence/orm/coupon-reservation.typeorm.entity";
import { GetCouponReservationStatusUseCase } from "./application/use-cases/tier-1-in-domain/get-coupon-reservation-status.use-case";
import { IssueUserCouponReservedConsumer } from "@/coupon/infrastructure/messaging/issue-user-coupon-reserved.consumer";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserCouponTypeOrmEntity,
      CouponTypeOrmEntity,
      CouponReservationTypeOrmEntity,
      OutboxTypeOrmEntity,
    ]),
    AuthModule,
    LocksModule,
    RedisModule,
    KafkaModule,
  ],
  controllers: [CouponController, UserCouponController],
  providers: [
    GetAllCouponsUseCase,
    GetAllUserCouponsUseCase,
    GetCouponByIdUseCase,
    IssueUserCouponUseCase,
    IssueUserCouponWithRedisUseCase,
    IssueUserCouponWithSpinLockUseCase,
    IssueUserCouponWithPubSubLockUseCase,
    IssueUserCouponWithQueueLockUseCase,
    IssueUserCouponWithFencingLockUseCase,
    IssueUserCouponWithRedlockSpinLockUseCase,
    IssueUserCouponWithFencingTokenUseCase,
    GetCouponReservationStatusUseCase,
    ReserveIssueUserCouponUseCase,
    UseUserCouponUseCase,
    ValidateUserCouponUseCase,
    CancelUserCouponUseCase,
    RecoverUserCouponUseCase,
    ValidateUserCouponService,
    UserCouponRepository,
    CouponRepository,
    CouponRedisRepository,
    CouponReservationRepository,
    OutboxRepository,
    IssueUserCouponReservedConsumer,
  ],
  exports: [
    ValidateUserCouponUseCase,
    UseUserCouponUseCase,
    RecoverUserCouponUseCase,
  ],
})
export class CouponModule {}
