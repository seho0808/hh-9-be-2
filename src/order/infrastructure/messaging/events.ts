import { Order } from "@/order/domain/entities/order.entitiy";

export class OrderPlacedEvent {
  constructor(public readonly order: Order) {}
}
