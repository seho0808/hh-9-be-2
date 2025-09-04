import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  OutboxStatus,
  OutboxTypeOrmEntity,
} from "@/common/infrastructure/persistence/orm/outbox.typeorm.entity";

export interface AppendOutboxEventParams {
  eventType: string;
  payload: any;
  idempotencyKey: string;
}

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(OutboxTypeOrmEntity)
    private readonly repository: Repository<OutboxTypeOrmEntity>
  ) {}

  async appendEvent(
    params: AppendOutboxEventParams
  ): Promise<OutboxTypeOrmEntity> {
    const entity = this.repository.create({
      eventType: params.eventType,
      idempotencyKey: params.idempotencyKey,
      payload: params.payload,
      status: OutboxStatus.NEW,
      attempts: 0,
      lastError: null,
      publishedAt: null,
    });
    return await this.repository.save(entity);
  }

  async findNew(limit: number = 100): Promise<OutboxTypeOrmEntity[]> {
    return await this.repository.find({
      where: { status: OutboxStatus.NEW },
      order: { createdAt: "ASC" },
      take: limit,
    });
  }

  async markProcessing(id: string): Promise<boolean> {
    const result = await this.repository.update(
      { id, status: OutboxStatus.NEW },
      { status: OutboxStatus.PROCESSING }
    );
    return result.affected === 1;
  }

  async markPublished(id: string): Promise<void> {
    await this.repository.update(
      { id },
      { status: OutboxStatus.PUBLISHED, publishedAt: new Date() }
    );
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const existing = await this.repository.findOne({ where: { id } });
    const attempts = (existing?.attempts ?? 0) + 1;
    await this.repository.update(
      { id },
      { status: OutboxStatus.FAILED, lastError: errorMessage, attempts }
    );
  }

  async resetToNew(id: string): Promise<void> {
    await this.repository.update({ id }, { status: OutboxStatus.NEW });
  }

  async findProcessing(limit: number = 100): Promise<OutboxTypeOrmEntity[]> {
    return await this.repository.find({
      where: { status: OutboxStatus.PROCESSING },
      order: { updatedAt: "ASC" },
      take: limit,
    });
  }
}
