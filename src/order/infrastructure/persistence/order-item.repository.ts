import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  OrderItemRepositoryInterface,
  PopularProductResult,
} from "@/order/domain/interfaces/order-item.repository.interface";
import { OrderItem } from "@/order/domain/entities/order-item.entity";
import { OrderItemTypeOrmEntity } from "./orm/order-item.typeorm.entity";

@Injectable()
export class OrderItemRepository implements OrderItemRepositoryInterface {
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
      .addSelect("COUNT(DISTINCT orderItem.orderId)", "totalOrders")
      .where("order.status = :status", { status: "SUCCESS" })
      .groupBy("orderItem.productId")
      .orderBy("SUM(orderItem.quantity)", "DESC")
      .limit(limit)
      .getRawMany();

    return result.map((row) => ({
      productId: row.productId,
      totalQuantity: parseInt(row.totalQuantity),
      totalOrders: parseInt(row.totalOrders),
    }));
  }

  private fromDomain(orderItem: OrderItem): OrderItemTypeOrmEntity {
    const props = orderItem.toPersistence();
    const entity = new OrderItemTypeOrmEntity();
    entity.id = props.id;
    entity.orderId = props.orderId;
    entity.productId = props.productId;
    entity.quantity = props.quantity;
    entity.unitPrice = props.unitPrice;
    entity.totalPrice = props.totalPrice;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }
}
