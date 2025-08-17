import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisModule } from "../config/redis.module";
import { SpinLockService } from "./spin-lock.service";
import { RedlockSpinLockService } from "./redlock-spin-lock.service";
import { PubSubLockService } from "./pubsub-lock.service";
import { QueueLockService } from "./queue-lock.service";
import { FencingLockService } from "./fencing-lock.service";

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [
    SpinLockService,
    RedlockSpinLockService,
    PubSubLockService,
    QueueLockService,
    FencingLockService,
  ],
  exports: [
    SpinLockService,
    RedlockSpinLockService,
    PubSubLockService,
    QueueLockService,
    FencingLockService,
  ],
})
export class LocksModule {}
