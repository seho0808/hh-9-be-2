import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

@Injectable()
export class GetOrdersByUserIdUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(userId: string): Promise<Order[]> {
    const orders = await this.orderRepository.findByUserId(userId);
    return orders;
  }
}
