import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum PointTransactionType {
  CHARGE = "CHARGE",
  USE = "USE",
  RECOVER = "RECOVER",
}

@Entity("point_transactions")
export class PointTransactionTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", name: "user_id" })
  @Index("idx_point_transactions_user_id")
  userId: string;

  @Column({ type: "int" })
  amount: number;

  @Column({ type: "enum", name: "type", enum: PointTransactionType })
  type: PointTransactionType;

  @Column({ type: "varchar", name: "idempotency_key" })
  idempotencyKey: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
