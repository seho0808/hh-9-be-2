import { OrderItem } from "../entities/order-item.entity";

export interface PopularProductResult {
  productId: string;
  totalQuantity: number;
  totalOrders: number;
}

export interface OrderItemRepositoryInterface {
  save(orderItem: OrderItem): Promise<void>;
  findPopularProducts(limit: number): Promise<PopularProductResult[]>;
}
