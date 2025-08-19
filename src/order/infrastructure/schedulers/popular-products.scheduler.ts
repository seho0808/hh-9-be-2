import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderItemRedisRepository } from "../persistence/order-item-redis.repository";

@Injectable()
export class PopularProductsScheduler {
  constructor(
    private readonly orderItemRedisRepository: OrderItemRedisRepository
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleMidnightRollover(): Promise<void> {
    await this.orderItemRedisRepository.midnightRollOver();
  }
}
