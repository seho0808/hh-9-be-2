import { Injectable, Logger, LoggerService } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OnEvent } from "@nestjs/event-emitter";
import { OrderPlacedEvent } from "@/order/infrastructure/messaging/events";
import { v4 as uuidv4 } from "uuid";
import { KafkaManager } from "@/common/infrastructure/config/kafka.config";
import {
  DataPlatformOrderEvent,
  DataPlatformOrderPayload,
} from "./data-platform.event";

@Injectable()
export class DataPlatformMessaging {
  constructor(private readonly kafkaManager: KafkaManager) {}

  @OnEvent("order.placed", { async: true })
  async publishOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    const order: Order = event.order;
    const payload: DataPlatformOrderPayload = this.buildPayload(order);
    const dataPlatformEvent: DataPlatformOrderEvent = {
      eventId: uuidv4(),
      eventType: "order.placed",
      timestamp: new Date().toISOString(),
      data: payload,
      idempotencyKey: order.id,
    };
    await this.kafkaManager.sendMessage(
      "data-platform.order.placed",
      dataPlatformEvent
    );
  }

  private buildPayload(order: Order): DataPlatformOrderPayload {
    return {
      eventId: uuidv4(),
      orderId: order.id,
      userId: order.userId,
      totalPrice: order.totalPrice,
      discountPrice: order.discountPrice,
      finalPrice: order.finalPrice,
      createdAt: order.createdAt.toISOString(),
      items: order.orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      idempotencyKey: order.id,
    };
  }
}
