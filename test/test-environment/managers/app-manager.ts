import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StartedMySqlContainer } from "@testcontainers/mysql";
import { DataSource } from "typeorm";
import {
  addTransactionalDataSource,
  initializeTransactionalContext,
} from "typeorm-transactional";
import { AppModule } from "../../../src/app.module";
import { DatabaseModule } from "../../../src/common/infrastructure/config/database.module";
import { ALL_ENTITIES } from "../constants";
import { StartedKafkaContainer } from "@testcontainers/kafka";
import { KAFKA_BROKERS_TOKEN } from "../../../src/common/infrastructure/config/kafka.config";

export class AppManager {
  private createTypeOrmModule(container: StartedMySqlContainer) {
    return TypeOrmModule.forRoot({
      type: "mysql",
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getUserPassword(),
      database: container.getDatabase(),
      entities: ALL_ENTITIES,
      synchronize: true,
      dropSchema: true,
      logging: false,
    });
  }

  private async configureApp(app: INestApplication): Promise<void> {
    app.setGlobalPrefix("api");

    const { GlobalExceptionFilter } = await import(
      "../../../src/common/presentation/filters/global-exception.filter"
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
  }

  async createApp(
    container: StartedMySqlContainer,
    kafkaContainer?: StartedKafkaContainer
  ): Promise<INestApplication> {
    initializeTransactionalContext();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(this.createTypeOrmModule(container))
      .overrideProvider(KAFKA_BROKERS_TOKEN)
      .useValue([
        `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`,
      ])
      .compile();

    const app = moduleFixture.createNestApplication();
    await this.configureApp(app);
    await app.init();

    const dataSource = app.get(DataSource);
    addTransactionalDataSource(dataSource);
    return app;
  }
}
