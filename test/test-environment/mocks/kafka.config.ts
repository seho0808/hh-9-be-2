import { Injectable } from "@nestjs/common";
import { Kafka, Producer, Consumer, Admin } from "kafkajs";
import { StartedKafkaContainer } from "@testcontainers/kafka";

@Injectable()
export class TestKafkaConfig {
  private readonly testKafka: Kafka;
  private readonly testProducer: Producer;
  private readonly testConsumer: Consumer;
  private readonly testAdmin: Admin;

  constructor(kafkaContainer: StartedKafkaContainer) {
    this.testKafka = new Kafka({
      clientId: "test-kafka-client",
      brokers: [
        `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
      ],
      retry: {
        initialRetryTime: 100,
        retries: 3,
      },
    });

    this.testProducer = this.testKafka.producer({
      allowAutoTopicCreation: true,
    });

    this.testConsumer = this.testKafka.consumer({
      groupId: "test-consumer-group",
      allowAutoTopicCreation: true,
    });

    this.testAdmin = this.testKafka.admin();
  }

  getKafka(): Kafka {
    return this.testKafka;
  }

  getProducer(): Producer {
    return this.testProducer;
  }

  getConsumer(): Consumer {
    return this.testConsumer;
  }

  getAdmin(): Admin {
    return this.testAdmin;
  }

  async initialize(): Promise<void> {
    await Promise.all([this.testProducer.connect(), this.testAdmin.connect()]);
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.testProducer.disconnect(),
      this.testConsumer.disconnect(),
      this.testAdmin.disconnect(),
    ]);
  }
}
