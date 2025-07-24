import { Injectable, Inject } from "@nestjs/common";
import {
  OrderItemRepositoryInterface,
  PopularProductResult,
} from "../interfaces/order-item.repository.interface";

export interface GetPopularProductsCommand {
  limit?: number;
}

@Injectable()
export class GetPopularProductsUseCase {
  constructor(
    @Inject("OrderItemRepositoryInterface")
    private readonly orderItemRepository: OrderItemRepositoryInterface
  ) {}

  async execute(
    command: GetPopularProductsCommand
  ): Promise<PopularProductResult[]> {
    const { limit = 10 } = command;
    return await this.orderItemRepository.findPopularProducts(limit);
  }
}
