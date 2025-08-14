import { Module } from "@nestjs/common";
import { RedisManager } from "./redis.config";

@Module({
  imports: [],
  providers: [RedisManager],
  exports: [RedisManager],
})
export class RedisModule {}
