import { CouponReservationStatus } from "@/coupon/domain/entities/coupon-reservation.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("coupon_reservations")
export class CouponReservationTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "coupon_id" })
  couponId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "varchar", name: "coupon_code" })
  couponCode: string;

  @Column({ type: "varchar", name: "idempotency_key" })
  idempotencyKey: string;

  @Column({ type: "enum", name: "status", enum: CouponReservationStatus })
  status: CouponReservationStatus;

  @Column({ type: "timestamp", name: "expires_at" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
