import { Inject, Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

export interface FindFailedOrdersUseCaseCommand {
  limit: number;
}

export interface FindFailedOrdersUseCaseResult {
  orders: Order[];
}

@Injectable()
export class FindFailedOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(
    command: FindFailedOrdersUseCaseCommand
  ): Promise<FindFailedOrdersUseCaseResult> {
    const { limit } = command;

    const orders = await this.orderRepository.findFailedOrders(limit);

    return { orders };
  }
}
