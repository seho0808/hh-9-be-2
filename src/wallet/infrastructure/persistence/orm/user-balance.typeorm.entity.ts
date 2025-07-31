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

@Entity("user_balances")
export class UserBalanceTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  @Index("idx_user_balances_user_id")
  userId: string;

  @Column({ type: "int", name: "balance" })
  balance: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => UserTypeOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserTypeOrmEntity;
}
