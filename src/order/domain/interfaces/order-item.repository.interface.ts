import { OrderItem } from "../entities/order-item.entity";

export interface OrderItemRepositoryInterface {
  save(orderItem: OrderItem): Promise<void>;
}
