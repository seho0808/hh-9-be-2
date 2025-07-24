import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { OrderTypeOrmEntity } from "./order.typeorm.entity";

@Entity("order_items")
export class OrderItemTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, name: "order_id" })
  @Index("idx_order_items_order_id")
  orderId: string;

  @Column({ type: "varchar", length: 255, name: "product_id" })
  @Index("idx_order_items_product_id")
  productId: string;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "int", name: "unit_price" })
  unitPrice: number;

  @Column({ type: "int", name: "total_price" })
  totalPrice: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => OrderTypeOrmEntity, (order) => order.orderItems, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "order_id" })
  order: OrderTypeOrmEntity;
}
