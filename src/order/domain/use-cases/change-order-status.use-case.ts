import { Inject, Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "../entities/order.entitiy";
import { OrderRepositoryInterface } from "../interfaces/order.repository.interface";
import { OrderNotFoundError } from "../exceptions/order.exceptions";

export interface ChangeOrderStatusUseCaseCommand {
  orderId: string;
  status: OrderStatus;
}

export interface ChangeOrderStatusUseCaseResult {
  order: Order;
}

@Injectable()
export class ChangeOrderStatusUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface
  ) {}

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
