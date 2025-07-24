import { Inject, Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "../entities/order.entitiy";
import { OrderRepositoryInterface } from "../interfaces/order.repository.interface";
import { OrderItem } from "../entities/order-item.entity";
import { OrderItemRepositoryInterface } from "../interfaces/order-item.repository.interface";

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
    private readonly orderItemRepository: OrderItemRepositoryInterface
  ) {}

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

    await Promise.all([
      this.orderRepository.save(order),
      ...orderItems.map((orderItem) =>
        this.orderItemRepository.save(orderItem)
      ),
    ]);

    return {
      order,
    };
  }
}
