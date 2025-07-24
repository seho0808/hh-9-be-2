import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { OrderItemRepositoryInterface } from "@/order/domain/interfaces/order-item.repository.interface";
import { OrderItem } from "@/order/domain/entities/order-item.entity";
import { OrderItemTypeOrmEntity } from "./orm/order-item.typeorm.entity";

@Injectable()
export class OrderItemRepository implements OrderItemRepositoryInterface {
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(OrderItemTypeOrmEntity)
    private readonly orderItemRepository: Repository<OrderItemTypeOrmEntity>
  ) {}

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<OrderItemTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(OrderItemTypeOrmEntity)
      : this.orderItemRepository;
  }

  async save(orderItem: OrderItem): Promise<void> {
    const repository = this.getRepository();
    const entity = this.fromDomain(orderItem);
    await repository.save(entity);
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
