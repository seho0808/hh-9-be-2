import { Module, OnModuleInit } from "@nestjs/common";
import { KafkaManager } from "./kafka.config";

@Module({
  providers: [KafkaManager],
  exports: [KafkaManager],
})
export class KafkaModule implements OnModuleInit {
  constructor(private readonly kafkaManager: KafkaManager) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaManager.initialize();
  }
}
