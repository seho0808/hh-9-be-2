import { Module, OnModuleInit } from "@nestjs/common";
import { KafkaManager, KAFKA_BROKERS_TOKEN } from "./kafka.config";

@Module({
  providers: [
    {
      provide: KAFKA_BROKERS_TOKEN,
      useFactory: () => {
        const brokersEnv = process.env.KAFKA_BROKERS;
        return brokersEnv
          ? brokersEnv
              .split(",")
              .map((b) => b.trim())
              .filter(Boolean)
          : undefined;
      },
    },
    KafkaManager,
  ],
  exports: [KafkaManager],
})
export class KafkaModule implements OnModuleInit {
  constructor(private readonly kafkaManager: KafkaManager) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaManager.initialize();
  }
}
