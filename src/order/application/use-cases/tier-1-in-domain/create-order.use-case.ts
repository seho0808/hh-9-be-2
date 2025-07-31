import { Inject, Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { Transactional } from "typeorm-transactional";
import { OrderItem } from "@/order/domain/entities/order-item.entity";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";
import { OrderItemRepository } from "@/order/infrastructure/persistence/order-item.repository";

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
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository
  ) {}

  @Transactional()
  async execute(
    command: CreateOrderUseCaseCommand
  ): Promise<CreateOrderUseCaseResult> {
    const { userId, idempotencyKey, items } = command;

    const order = Order.create({
      userId,
      totalPrice: 0,
      discountPrice: 0,
      finalPrice: 0,
      status: OrderStatus.PENDING,
      idempotencyKey,
    });

    const orderItems = items.map((item) =>
      OrderItem.create({
        ...item,
        orderId: order.id,
      })
    );

    order.initOrderItems(orderItems);

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
