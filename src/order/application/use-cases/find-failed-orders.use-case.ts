import { Inject, Injectable } from "@nestjs/common";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";
import { Order } from "@/order/domain/entities/order.entitiy";

export interface FindFailedOrdersUseCaseCommand {
  limit: number;
}

export interface FindFailedOrdersUseCaseResult {
  orders: Order[];
}

@Injectable()
export class FindFailedOrdersUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface
  ) {}

  async execute(
    command: FindFailedOrdersUseCaseCommand
  ): Promise<FindFailedOrdersUseCaseResult> {
    const { limit } = command;

    const orders = await this.orderRepository.findFailedOrders(limit);

    return { orders };
  }
}
