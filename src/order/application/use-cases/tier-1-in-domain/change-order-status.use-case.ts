import { Inject, Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { OrderNotFoundError } from "@/order/application/order.application.exceptions";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

export interface ChangeOrderStatusUseCaseCommand {
  orderId: string;
  status: OrderStatus;
}

export interface ChangeOrderStatusUseCaseResult {
  order: Order;
}

@Injectable()
export class ChangeOrderStatusUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(
    command: ChangeOrderStatusUseCaseCommand
  ): Promise<ChangeOrderStatusUseCaseResult> {
    const { orderId, status } = command;

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    order.changeStatus(status);

    await this.orderRepository.save(order);

    return { order };
  }
}
