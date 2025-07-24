import { Order } from "../entities/order.entitiy";

export interface OrderRepositoryInterface {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  findStalePendingOrders(
    minutesThreshold: number,
    limit: number
  ): Promise<Order[]>;
  findFailedOrders(limit: number): Promise<Order[]>;
}
