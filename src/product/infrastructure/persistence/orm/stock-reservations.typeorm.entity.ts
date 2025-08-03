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
import { ProductTypeOrmEntity } from "./product.typeorm.entity";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";
import { StockReservationStatus } from "@/product/domain/entities/stock-reservation.entity";

@Entity("stock_reservations")
export class StockReservationTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "integer" })
  quantity: number;

  @Column({ type: "enum", name: "status", enum: StockReservationStatus })
  status: StockReservationStatus;

  @Column({ type: "uuid", name: "order_id" })
  orderId: string;

  @Column({ type: "timestamp", name: "expires_at" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => ProductTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "product_id" })
  product?: ProductTypeOrmEntity;

  @ManyToOne(() => UserTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: UserTypeOrmEntity;
}
