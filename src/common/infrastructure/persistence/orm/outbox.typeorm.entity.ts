import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum OutboxStatus {
  NEW = "NEW",
  PROCESSING = "PROCESSING",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
}

@Entity("outbox_events")
export class OutboxTypeOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", name: "event_type", length: 100 })
  @Index("idx_outbox_event_type")
  eventType: string;

  @Column({
    type: "varchar",
    name: "idempotency_key",
    length: 100,
    nullable: true,
  })
  @Index("idx_outbox_idempotency_key")
  idempotencyKey: string | null;

  @Column({ type: "json", name: "payload" })
  payload: any;

  @Column({
    type: "enum",
    enum: OutboxStatus,
    default: OutboxStatus.NEW,
  })
  @Index("idx_outbox_status")
  status: OutboxStatus;

  @Column({ type: "int", name: "attempts", default: 0 })
  attempts: number;

  @Column({ type: "text", name: "last_error", nullable: true })
  lastError: string | null;

  @Column({ type: "timestamp", name: "published_at", nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
