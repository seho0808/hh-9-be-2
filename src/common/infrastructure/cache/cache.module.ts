import { Module } from "@nestjs/common";
import { RedisModule } from "../config/redis.module";
import { CacheService } from "./cache.service";
import { CacheInvalidationService } from "./cache-invalidation.service";

@Module({
  imports: [RedisModule],
  providers: [CacheService, CacheInvalidationService],
  exports: [CacheService, CacheInvalidationService],
})
export class CacheModule {}
