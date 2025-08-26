import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderItemRedisRepository } from "@/order/infrastructure/persistence/order-item-redis.repository";

export interface UpdateProductRankingCommand {
  order: Order;
}

@Injectable()
export class UpdateProductRankingUseCase {
  constructor(
    private readonly orderItemRedisRepository: OrderItemRedisRepository
  ) {}

  async execute(command: UpdateProductRankingCommand): Promise<void> {
    const { order } = command;

    const updatePromises = order.orderItems.map(async (orderItem) => {
      await this.orderItemRedisRepository.updatePopularProducts(
        orderItem.productId,
        orderItem.quantity
      );
    });

    await Promise.all(updatePromises);
  }
}
