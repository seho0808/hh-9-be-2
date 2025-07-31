import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";

export enum PointTransactionType {
  CHARGE = "CHARGE",
  USE = "USE",
  RECOVER = "RECOVER",
}

@Entity("point_transactions")
export class PointTransactionTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  @Index("idx_point_transactions_user_id")
  userId: string;

  @Column({ type: "int" })
  amount: number;

  @Column({ type: "enum", name: "type", enum: PointTransactionType })
  type: PointTransactionType;

  @Column({
    type: "varchar",
    length: 100,
    name: "idempotency_key",
    nullable: true,
  })
  idempotencyKey: string | null;

  @Column({ type: "varchar", length: 100, name: "ref_id", nullable: true })
  refId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => UserTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserTypeOrmEntity;
}
