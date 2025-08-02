import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

export interface FindStalePendingOrdersUseCaseCommand {
  minutesThreshold: number;
  limit: number;
}

export interface FindStalePendingOrdersUseCaseResult {
  orders: Order[];
}

@Injectable()
export class FindStalePendingOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(
    command: FindStalePendingOrdersUseCaseCommand
  ): Promise<FindStalePendingOrdersUseCaseResult> {
    const { minutesThreshold, limit } = command;

    const orders = await this.orderRepository.findStalePendingOrders(
      minutesThreshold,
      limit
    );

    return { orders };
  }
}
