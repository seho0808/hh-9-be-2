import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Kafka, Producer, Consumer, Admin } from "kafkajs";

export const KAFKA_BROKERS_TOKEN = "KAFKA_BROKERS_TOKEN";

@Injectable()
export class KafkaManager implements OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumer: Consumer;
  private readonly admin: Admin;
  private isInitialized = false;

  constructor(@Inject(KAFKA_BROKERS_TOKEN) brokers?: string[]) {
    const resolvedBrokers =
      brokers && brokers.length > 0 ? brokers : ["localhost:9094"]; // fallback for local docker-compose

    this.kafka = new Kafka({
      clientId: "hh-week-2-app",
      brokers: resolvedBrokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    this.consumer = this.kafka.consumer({
      groupId: "hh-week-2-consumer-group",
      allowAutoTopicCreation: true,
    });

    this.admin = this.kafka.admin();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.all([
        this.producer.connect(),
        this.consumer.connect(),
        this.admin.connect(),
      ]);

      // 기본 토픽들 생성
      await this.createTopicsIfNotExist([
        "coupon.issued",
        "coupon.used",
        "coupon.expired",
      ]);

      this.isInitialized = true;
      console.log("Kafka initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Kafka:", error);
      throw error;
    }
  }

  private async createTopicsIfNotExist(topicNames: string[]): Promise<void> {
    try {
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = topicNames.filter(
        (topic) => !existingTopics.includes(topic)
      );

      if (topicsToCreate.length > 0) {
        await this.admin.createTopics({
          topics: topicsToCreate.map((topic) => ({
            topic,
            numPartitions: 3,
            replicationFactor: 1,
          })),
        });
        console.log("Created topics:", topicsToCreate);
      }
    } catch (error) {
      console.error("Failed to create topics:", error);
    }
  }

  getProducer(): Producer {
    if (!this.isInitialized) {
      throw new Error("Kafka is not initialized. Call initialize() first.");
    }
    return this.producer;
  }

  getConsumer(): Consumer {
    if (!this.isInitialized) {
      throw new Error("Kafka is not initialized. Call initialize() first.");
    }
    return this.consumer;
  }

  getAdmin(): Admin {
    if (!this.isInitialized) {
      throw new Error("Kafka is not initialized. Call initialize() first.");
    }
    return this.admin;
  }

  async sendMessage(topic: string, message: any): Promise<void> {
    const producer = this.getProducer();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
        },
      ],
    });
  }

  async sendMessages(topic: string, messages: any[]): Promise<void> {
    const producer = this.getProducer();
    await producer.send({
      topic,
      messages: messages.map((message) => ({
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
      })),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isInitialized) {
      await Promise.all([
        this.producer.disconnect(),
        this.consumer.disconnect(),
        this.admin.disconnect(),
      ]);
      console.log("Kafka disconnected");
    }
  }
}
