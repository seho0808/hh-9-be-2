import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { v4 as uuidv4 } from "uuid";
import { OutboxRepository } from "@/common/infrastructure/persistence/outbox.repository";
import { OutboxTypeOrmEntity } from "@/common/infrastructure/persistence/orm/outbox.typeorm.entity";
import { KafkaManager } from "@/common/infrastructure/config/kafka.config";

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private isRunning = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly kafkaManager: KafkaManager
  ) {}

  @Interval(1000)
  async pollAndPublish(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const events = await this.outboxRepository.findNew(100);
      for (const event of events) {
        const claimed = await this.outboxRepository.markProcessing(event.id);
        if (!claimed) continue;
        await this.publishSingle(event);
      }
    } catch (err) {
      this.logger.error(
        `Outbox polling failed: ${String((err as Error)?.message || err)}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async publishSingle(event: OutboxTypeOrmEntity): Promise<void> {
    const envelope = this.domainEventToKafkaEnvelope(event);
    const topic = this.domainEventToKafkaTopic(event.eventType);
    try {
      await this.kafkaManager.sendMessage(topic, envelope);
      await this.outboxRepository.markPublished(event.id);
    } catch (err) {
      const message = String((err as Error)?.message || err);
      this.logger.warn(
        `Failed to publish outbox ${event.id} to ${topic}: ${message}`
      );
      await this.outboxRepository.markFailed(event.id, message);
    }
  }

  private domainEventToKafkaEnvelope(event: OutboxTypeOrmEntity): any {
    return {
      eventId: uuidv4(),
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      data: event.payload,
      idempotencyKey: event.idempotencyKey,
    };
  }

  private domainEventToKafkaTopic(eventType: string): string {
    const map: Record<string, string> = {
      "issue.usercoupon.reserved": "issue.usercoupon.reserved",
    };
    return map[eventType];
  }
}
