import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("coupons")
export class CouponTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", name: "coupon_code", length: 100, unique: true })
  @Index("idx_coupons_coupon_code")
  couponCode: string;

  @Column({ type: "varchar", name: "discount_type", length: 20 })
  @Index("idx_coupons_discount_type")
  discountType: string; // FIXED or PERCENTAGE

  @Column({ type: "int", name: "discount_value" })
  discountValue: number;

  @Column({ type: "int", name: "minimum_order_price" })
  minimumOrderPrice: number;

  @Column({ type: "int", name: "max_discount_price", nullable: true })
  maxDiscountPrice: number | null;

  @Column({ type: "int", name: "issued_count", default: 0 })
  issuedCount: number;

  @Column({ type: "int", name: "used_count", default: 0 })
  usedCount: number;

  @Column({ type: "int", name: "total_count" })
  totalCount: number;

  @Column({ type: "timestamp", name: "start_date" })
  @Index("idx_coupons_start_date")
  startDate: Date;

  @Column({ type: "timestamp", name: "end_date" })
  @Index("idx_coupons_end_date")
  endDate: Date;

  @Column({ type: "int", name: "expires_in_days" })
  expiresInDays: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
