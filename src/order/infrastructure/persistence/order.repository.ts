import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager, LessThan } from "typeorm";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { OrderTypeOrmEntity } from "./orm/order.typeorm.entity";
import { OrderItem } from "@/order/domain/entities/order-item.entity";
import { TransactionContext } from "@/common/services/transaction.service";

@Injectable()
export class OrderRepository implements OrderRepositoryInterface {
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(OrderTypeOrmEntity)
    private readonly orderRepository: Repository<OrderTypeOrmEntity>
  ) {
    TransactionContext.registerRepository(this);
  }

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<OrderTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(OrderTypeOrmEntity)
      : this.orderRepository;
  }

  async save(order: Order): Promise<Order> {
    const repository = this.getRepository();
    const entity = this.fromDomain(order);
    const savedEntity = await repository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<Order | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({
      where: { id },
      relations: ["orderItems"],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const repository = this.getRepository();
    const entities = await repository.find({
      where: { userId },
      relations: ["orderItems"],
      order: { createdAt: "DESC" },
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
