import { Inject, Injectable } from "@nestjs/common";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";
import { Order } from "@/order/domain/entities/order.entitiy";

@Injectable()
export class GetOrderByUserIdUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface
  ) {}

  async execute(userId: string): Promise<Order[]> {
    const orders = await this.orderRepository.findByUserId(userId);
    return orders;
  }
}
