import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("stock_reservations")
export class StockReservationTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  productId: string;

  @Column({ type: "varchar", length: 255 })
  userId: string;

  @Column({ type: "integer" })
  quantity: number;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @Column({ type: "varchar", length: 255 })
  idempotencyKey: string;

  @Column({ type: "timestamp", name: "expires_at" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
