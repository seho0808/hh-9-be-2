import { Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "../entities/order.entitiy";
import { OrderItem } from "../entities/order-item.entity";

@Injectable()
export class CreateOrderDomainService {
  async createOrder({
    userId,
    idempotencyKey,
    items,
  }: {
    userId: string;
    idempotencyKey: string;
    items: {
      productId: string;
      unitPrice: number;
      quantity: number;
    }[];
  }): Promise<Order> {
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

    return order;
  }
}
