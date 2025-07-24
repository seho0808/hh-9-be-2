import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum UserCouponStatus {
  ISSUED = "ISSUED",
  USED = "USED",
  CANCELLED = "CANCELLED",
}

@Entity("user_coupons")
export class UserCouponTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", name: "coupon_id", length: 255 })
  @Index("idx_user_coupons_coupon_id")
  couponId: string;

  @Column({ type: "varchar", name: "user_id", length: 255 })
  @Index("idx_user_coupons_user_id")
  userId: string;

  @Column({ type: "varchar", name: "order_id", length: 255, nullable: true })
  orderId: string | null;

  @Column({ type: "int", name: "discount_price", nullable: true })
  discountPrice: number | null;

  @Column({
    type: "enum",
    enum: UserCouponStatus,
    default: UserCouponStatus.ISSUED,
  })
  status: UserCouponStatus;

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
}
