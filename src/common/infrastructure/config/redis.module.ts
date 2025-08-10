import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisConfig } from "./redis.config";

@Module({
  imports: [ConfigModule],
  providers: [RedisConfig],
  exports: [RedisConfig],
})
export class RedisModule {}
