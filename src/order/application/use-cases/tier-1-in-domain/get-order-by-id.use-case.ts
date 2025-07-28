import { Inject, Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";

@Injectable()
export class GetOrderByIdUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface
  ) {}

  async execute(orderId: string): Promise<Order | null> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      return null;
    }
    return order;
  }
}
