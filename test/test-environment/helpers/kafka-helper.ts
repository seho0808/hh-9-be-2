import { Injectable } from "@nestjs/common";
import { Kafka, Producer, Consumer, Admin } from "kafkajs";
import { StartedKafkaContainer } from "@testcontainers/kafka";
@Injectable()
export class KafkaHelper {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;

  constructor(private readonly kafkaContainer: StartedKafkaContainer) {
    this.kafka = new Kafka({
      clientId: "test-client",
      brokers: [
        `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
      ],
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: "test-group" });
    this.admin = this.kafka.admin();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.producer.connect(),
      this.consumer.connect(),
      this.admin.connect(),
    ]);
  }

  getKafka(): Kafka {
    return this.kafka;
  }

  getProducer(): Producer {
    return this.producer;
  }

  getConsumer(): Consumer {
    return this.consumer;
  }

  getAdmin(): Admin {
    return this.admin;
  }

  async createTopic(topicName: string, partitions = 1): Promise<void> {
    await this.admin.createTopics({
      topics: [
        {
          topic: topicName,
          numPartitions: partitions,
          replicationFactor: 1,
        },
      ],
    });
  }

  async deleteTopic(topicName: string): Promise<void> {
    await this.admin.deleteTopics({
      topics: [topicName],
    });
  }

  async listTopics(): Promise<string[]> {
    return this.admin.listTopics();
  }

  async sendMessage(topic: string, message: any): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
    });
  }

  async sendMessages(topic: string, messages: any[]): Promise<void> {
    await this.producer.send({
      topic,
      messages: messages.map((message) => ({
        value: JSON.stringify(message),
      })),
    });
  }

  async subscribeToTopic(topic: string): Promise<void> {
    await this.consumer.subscribe({ topic });
  }

  async consumeMessages(
    callback: (message: any) => void,
    timeout = 5000
  ): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (message.value) {
          const parsedMessage = JSON.parse(message.value.toString());
          callback(parsedMessage);
        }
      },
    });

    // Stop consuming after timeout
    setTimeout(async () => {
      await this.consumer.stop();
    }, timeout);
  }

  async clearAllMessages(): Promise<void> {
    const topics = await this.listTopics();
    const filteredTopics = topics.filter(
      (topic) => !topic.startsWith("__") // Exclude internal topics
    );

    for (const topic of filteredTopics) {
      await this.deleteTopic(topic);
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.admin.listTopics();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.producer.disconnect(),
      this.consumer.disconnect(),
      this.admin.disconnect(),
    ]);
  }

  getBrokers(): string[] {
    return [
      `${this.kafkaContainer.getHost()}:${this.kafkaContainer.getMappedPort(9093)}`,
    ];
  }
}
