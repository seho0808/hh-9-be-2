import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";
import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "../entities/order.entitiy";
import { OrderRepositoryInterface } from "../interfaces/order.repository.interface";

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
