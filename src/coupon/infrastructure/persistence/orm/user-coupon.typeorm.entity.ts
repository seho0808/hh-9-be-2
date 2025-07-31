import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";
import { CouponTypeOrmEntity } from "./coupon.typeorm.entity";
import { OrderTypeOrmEntity } from "@/order/infrastructure/persistence/orm/order.typeorm.entity";

export enum UserCouponStatus {
  ISSUED = "ISSUED",
  USED = "USED",
  CANCELLED = "CANCELLED",
}

@Entity("user_coupons")
export class UserCouponTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "coupon_id" })
  @Index("idx_user_coupons_coupon_id")
  couponId: string;

  @Column({ type: "uuid", name: "user_id" })
  @Index("idx_user_coupons_user_id")
  userId: string;

  @Column({ type: "uuid", name: "order_id", nullable: true })
  orderId: string | null;

  @Column({ type: "int", name: "discount_price", nullable: true })
  discountPrice: number | null;

  @Column({
    type: "enum",
    enum: UserCouponStatus,
    default: UserCouponStatus.ISSUED,
  })
  status: UserCouponStatus;

  @Column({ type: "varchar", name: "issued_idempotency_key", nullable: true })
  issuedIdempotencyKey: string | null;

  @Column({ type: "timestamp", name: "expires_at" })
  @Index("idx_user_coupons_expires_at")
  expiresAt: Date;

  @Column({ type: "timestamp", name: "used_at", nullable: true })
  usedAt: Date | null;

  @Column({ type: "timestamp", name: "cancelled_at", nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => UserTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserTypeOrmEntity;

  @ManyToOne(() => CouponTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "coupon_id" })
  coupon: CouponTypeOrmEntity;

  @OneToOne(() => OrderTypeOrmEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "order_id" })
  order?: OrderTypeOrmEntity;
}
