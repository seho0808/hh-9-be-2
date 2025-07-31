import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";
import { UserCouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { OrderItemTypeOrmEntity } from "./order-item.typeorm.entity";

export enum OrderStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

@Entity("orders")
export class OrderTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, name: "user_id" })
  @Index("idx_orders_user_id")
  userId: string;

  @Column({ type: "int", name: "total_price" })
  totalPrice: number;

  @Column({ type: "int", name: "discount_price", default: 0 })
  discountPrice: number;

  @Column({ type: "int", name: "final_price" })
  finalPrice: number;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PENDING })
  @Index("idx_orders_status")
  status: OrderStatus;

  @Column({ type: "text", name: "failed_reason", nullable: true })
  failedReason: string | null;

  @Column({ type: "varchar", length: 255, name: "idempotency_key" })
  @Index("idx_orders_idempotency_key", { unique: true })
  idempotencyKey: string;

  @Column({
    type: "varchar",
    length: 255,
    name: "applied_coupon_id",
    nullable: true,
  })
  appliedCouponId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @OneToMany(() => OrderItemTypeOrmEntity, "order", {
    cascade: true,
  })
  orderItems: OrderItemTypeOrmEntity[];

  @ManyToOne(() => UserTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserTypeOrmEntity;

  @OneToOne(() => UserCouponTypeOrmEntity, { onDelete: "SET NULL" })
  appliedCoupon?: UserCouponTypeOrmEntity;
}
