import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { OrderTypeOrmEntity } from "./orm/order.typeorm.entity";
import { OrderItem } from "@/order/domain/entities/order-item.entity";

@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(OrderTypeOrmEntity)
    private readonly orderRepository: Repository<OrderTypeOrmEntity>
  ) {}

  async save(order: Order): Promise<Order> {
    const entity = this.fromDomain(order);
    const savedEntity = await this.orderRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<Order | null> {
    const entity = await this.orderRepository.findOne({
      where: { id },
      relations: ["orderItems"],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const entities = await this.orderRepository.find({
      where: { userId },
      relations: ["orderItems"],
      order: { createdAt: "DESC" },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findFailedOrders(limit: number = 100): Promise<Order[]> {
    const entities = await this.orderRepository.find({
      where: { status: OrderStatus.FAILED },
      relations: ["orderItems"],
      order: { updatedAt: "ASC" },
      take: limit,
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findStalePendingOrders(
    timeoutMinutes: number,
    limit: number = 100
  ): Promise<Order[]> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const entities = await this.orderRepository.find({
      where: {
        status: OrderStatus.PENDING,
        createdAt: LessThan(cutoffTime),
      },
      relations: ["orderItems"],
      order: { createdAt: "ASC" },
      take: limit,
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  private toDomain(entity: OrderTypeOrmEntity): Order {
    const orderItems =
      entity.orderItems?.map((item) =>
        OrderItem.fromPersistence({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
      ) || [];

    return Order.fromPersistence({
      id: entity.id,
      userId: entity.userId,
      totalPrice: entity.totalPrice,
      discountPrice: entity.discountPrice,
      finalPrice: entity.finalPrice,
      status: entity.status,
      failedReason: entity.failedReason,
      idempotencyKey: entity.idempotencyKey,
      appliedCouponId: entity.appliedCouponId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      OrderItems: orderItems,
    });
  }

  private fromDomain(order: Order): OrderTypeOrmEntity {
    const props = order.toPersistence();
    const entity = new OrderTypeOrmEntity();
    entity.id = props.id;
    entity.userId = props.userId;
    entity.totalPrice = props.totalPrice;
    entity.discountPrice = props.discountPrice;
    entity.finalPrice = props.finalPrice;
    entity.status = props.status;
    entity.failedReason = props.failedReason;
    entity.idempotencyKey = props.idempotencyKey;
    entity.appliedCouponId = props.appliedCouponId;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }
}
