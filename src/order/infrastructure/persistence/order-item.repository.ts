import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrderItem } from "@/order/domain/entities/order-item.entity";
import { OrderItemTypeOrmEntity } from "./orm/order-item.typeorm.entity";
import {
  PopularProductResult,
  PopularProductsQueryPort,
} from "@/order/application/ports/popular-products.port";
@Injectable()
export class OrderItemRepository implements PopularProductsQueryPort {
  constructor(
    @InjectRepository(OrderItemTypeOrmEntity)
    private readonly orderItemRepository: Repository<OrderItemTypeOrmEntity>
  ) {}

  async save(orderItem: OrderItem): Promise<void> {
    const entity = this.fromDomain(orderItem);
    await this.orderItemRepository.save(entity);
  }

  async findPopularProducts(limit: number): Promise<PopularProductResult[]> {
    const result = await this.orderItemRepository
      .createQueryBuilder("orderItem")
      .innerJoin("orderItem.order", "order")
      .select("orderItem.productId", "productId")
      .addSelect("SUM(orderItem.quantity)", "totalQuantity")
      .where("order.status = :status", { status: "SUCCESS" })
      .groupBy("orderItem.productId")
      .orderBy("SUM(orderItem.quantity)", "DESC")
      .limit(limit)
      .getRawMany();

    return result.map((row) => ({
      productId: row.productId,
      totalQuantity: parseInt(row.totalQuantity),
    }));
  }

  private fromDomain(orderItem: OrderItem): OrderItemTypeOrmEntity {
    const entity = new OrderItemTypeOrmEntity();
    entity.id = orderItem.id;
    entity.orderId = orderItem.orderId;
    entity.productId = orderItem.productId;
    entity.quantity = orderItem.quantity;
    entity.unitPrice = orderItem.unitPrice;
    entity.totalPrice = orderItem.totalPrice;
    entity.createdAt = orderItem.createdAt;
    entity.updatedAt = orderItem.updatedAt;
    return entity;
  }
}
