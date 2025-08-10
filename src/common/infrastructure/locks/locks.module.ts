import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisModule } from "../config/redis.module";
import { SpinLockService } from "./spin-lock.service";

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [SpinLockService],
  exports: [SpinLockService],
})
export class LocksModule {}
