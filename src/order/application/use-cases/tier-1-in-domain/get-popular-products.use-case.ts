import { Injectable, Inject } from "@nestjs/common";
import { PopularProductResult } from "@/product/application/use-cases/tier-2/get-popular-products-with-detail.use-case";
import { OrderItemRepository } from "@/order/infrastructure/persistence/order-item.repository";

export interface GetPopularProductsCommand {
  limit?: number;
}

@Injectable()
export class GetPopularProductsUseCase {
  constructor(private readonly orderItemRepository: OrderItemRepository) {}

  async execute(
    command: GetPopularProductsCommand
  ): Promise<PopularProductResult[]> {
    const { limit = 10 } = command;
    return await this.orderItemRepository.findPopularProducts(limit);
  }
}
