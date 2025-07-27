import { Inject, Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";
import { OrderItemRepositoryInterface } from "@/order/domain/interfaces/order-item.repository.interface";
import { CreateOrderDomainService } from "@/order/domain/services/create-order.service";

export interface CreateOrderUseCaseCommand {
  userId: string;
  idempotencyKey: string;
  items: {
    productId: string;
    unitPrice: number;
    quantity: number;
  }[];
}

export interface CreateOrderUseCaseResult {
  order: Order;
}

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface,
    @Inject("OrderItemRepositoryInterface")
    private readonly orderItemRepository: OrderItemRepositoryInterface,
    private readonly createOrderDomainService: CreateOrderDomainService
  ) {}

  async execute(
    command: CreateOrderUseCaseCommand
  ): Promise<CreateOrderUseCaseResult> {
    const { userId, idempotencyKey, items } = command;

    const order = await this.createOrderDomainService.createOrder({
      userId,
      idempotencyKey,
      items,
    });

    await this.orderRepository.save(order);
    await Promise.all(
      order.orderItems.map((orderItem) =>
        this.orderItemRepository.save(orderItem)
      )
    );

    return {
      order,
    };
  }
}
