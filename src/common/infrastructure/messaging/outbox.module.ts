import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxPublisher } from "@/common/infrastructure/messaging/outbox.publisher";
import { OutboxRepository } from "@/common/infrastructure/persistence/outbox.repository";
import { OutboxTypeOrmEntity } from "@/common/infrastructure/persistence/orm/outbox.typeorm.entity";
import { KafkaModule } from "@/common/infrastructure/config/kafka.module";

@Module({
  imports: [TypeOrmModule.forFeature([OutboxTypeOrmEntity]), KafkaModule],
  providers: [OutboxRepository, OutboxPublisher],
  exports: [OutboxPublisher],
})
export class OutboxModule {}
