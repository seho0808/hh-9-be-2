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

  @ManyToOne(() => ProductTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "product_id" })
  product: ProductTypeOrmEntity;

  @ManyToOne(() => UserTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserTypeOrmEntity;
}
