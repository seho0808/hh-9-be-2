import { Inject, Injectable } from "@nestjs/common";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";
import { Order } from "@/order/domain/entities/order.entitiy";

export interface FindStalePendingOrdersUseCaseCommand {
  minutesThreshold: number;
  limit: number;
}

export interface FindStalePendingOrdersUseCaseResult {
  orders: Order[];
}

@Injectable()
export class FindStalePendingOrdersUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface
  ) {}

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
