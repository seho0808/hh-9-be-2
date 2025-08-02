import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

@Injectable()
export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(orderId: string): Promise<Order | null> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      return null;
    }
    return order;
  }
}
