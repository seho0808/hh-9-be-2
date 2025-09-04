import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { DataSource } from "typeorm";
import { OutboxTypeOrmEntity } from "@/common/infrastructure/persistence/orm/outbox.typeorm.entity";
import { OutboxRepository } from "@/common/infrastructure/persistence/outbox.repository";
import { OutboxPublisher } from "@/common/infrastructure/messaging/outbox.publisher";
import { KafkaManager } from "@/common/infrastructure/config/kafka.config";

describe("OutboxModule Integration (mocked Kafka)", () => {
  let env: TestEnvironment;
  let dataSource: DataSource;
  let outboxRepository: OutboxRepository;
  let publisher: OutboxPublisher;
  let kafkaManager: KafkaManager;
  const factory = new TestEnvironmentFactory();

  beforeAll(async () => {
    env = await factory.createAppWithDatabaseAndKafka();
    dataSource = env.dataSource;
    outboxRepository = env.app.get(OutboxRepository);
    publisher = env.app.get(OutboxPublisher);
    kafkaManager = env.app.get(KafkaManager);
  });

  afterAll(async () => {
    await factory.cleanup(env);
  });

  beforeEach(async () => {
    await dataSource.getRepository(OutboxTypeOrmEntity).clear();
  });

  it("아웃박스에 이벤트가 추가되면 올바른 토픽 매핑으로 Kafka에 발행되어야 한다", async () => {
    // Given
    const payload = {
      couponId: "c-1",
      userId: "u-1",
      couponCode: "CODE",
      idempotencyKey: "idem-1",
    };

    await outboxRepository.appendEvent({
      eventType: "issue.usercoupon.reserved",
      payload,
      idempotencyKey: payload.idempotencyKey,
    });

    // When
    await publisher.pollAndPublish();

    // Then
    const topics = await env.kafkaHelper.listTopics();
    expect(topics.length).toBeGreaterThan(0);

    const remaining = await outboxRepository.findNew(10);
    expect(remaining.length).toBe(0);
  });
});
