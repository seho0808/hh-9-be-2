import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("products")
export class ProductTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100, unique: true })
  @Index("idx_products_name")
  name: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "int" })
  price: number;

  @Column({ type: "integer", name: "total_stock", default: 0 })
  totalStock: number;

  @Column({ type: "integer", name: "reserved_stock", default: 0 })
  reservedStock: number;

  @Column({ type: "boolean", name: "is_active", default: true })
  @Index("idx_products_is_active")
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
