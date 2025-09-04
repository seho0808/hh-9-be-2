import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { StartedMySqlContainer } from "@testcontainers/mysql";
import { StartedRedisContainer } from "@testcontainers/redis";
import { StartedKafkaContainer } from "@testcontainers/kafka";
import { ContainerManager } from "./managers/container-manager";
import { DatabaseManager } from "./managers/database-manager";
import { AppManager } from "./managers/app-manager";
import { DataHelper } from "./helpers/data-helper";
import { DbHelper } from "./helpers/db-helper";
import { RedisHelper } from "./helpers/redis-helper";
import { KafkaHelper } from "./helpers/kafka-helper";

export interface TestEnvironment {
  app?: INestApplication;
  dataSource: DataSource;
  mysqlContainer: StartedMySqlContainer;
  redisContainer?: StartedRedisContainer;
  kafkaContainer?: StartedKafkaContainer;
  dataHelper: DataHelper;
  dbHelper: DbHelper;
  redisHelper?: RedisHelper;
  kafkaHelper?: KafkaHelper;
}

export interface TestEnvironmentConfig {
  mysqlVersion?: string;
  redisVersion?: string;
  kafkaVersion?: string;
  database?: string;
  username?: string;
  password?: string;
}

export class TestEnvironmentFactory {
  private containerManager = new ContainerManager();
  private databaseManager = new DatabaseManager();
  private appManager = new AppManager();

  async createE2EEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const containers = await this.containerManager.setupMySQL(config);
    const app = await this.appManager.createApp(containers.mysqlContainer);
    const dataSource = app.get(DataSource);

    return {
      app,
      dataSource,
      mysqlContainer: containers.mysqlContainer,
      dataHelper: new DataHelper(dataSource, app),
      dbHelper: new DbHelper(dataSource),
    };
  }

  async createDatabaseOnlyEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const containers = await this.containerManager.setupMySQL(config);
    const dataSource = await this.databaseManager.createDataSource(
      containers.mysqlContainer
    );

    return {
      dataSource,
      mysqlContainer: containers.mysqlContainer,
      dataHelper: new DataHelper(dataSource),
      dbHelper: new DbHelper(dataSource),
    };
  }

  async createRedisOnlyEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const redisContainer = await this.containerManager.setupRedis(config);

    return {
      redisContainer,
      dataHelper: new DataHelper(null as any),
      dbHelper: new DbHelper(null as any),
      redisHelper: new RedisHelper(redisContainer),
    } as TestEnvironment;
  }

  async createKafkaOnlyEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const kafkaContainer = await this.containerManager.setupKafka(config);
    const kafkaHelper = new KafkaHelper(kafkaContainer);
    await kafkaHelper.initialize();

    return {
      kafkaContainer,
      dataHelper: new DataHelper(null as any),
      dbHelper: new DbHelper(null as any),
      kafkaHelper,
    } as TestEnvironment;
  }

  async createDatabaseAndRedisEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const containers = await this.containerManager.setupMySQLAndRedis(config);
    const dataSource = await this.databaseManager.createDataSource(
      containers.mysqlContainer
    );

    return {
      dataSource,
      mysqlContainer: containers.mysqlContainer,
      redisContainer: containers.redisContainer,
      dataHelper: new DataHelper(dataSource),
      dbHelper: new DbHelper(dataSource),
      redisHelper: new RedisHelper(containers.redisContainer),
    };
  }

  async createDatabaseAndKafkaEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const containers = await this.containerManager.setupMySQLAndKafka(config);
    const dataSource = await this.databaseManager.createDataSource(
      containers.mysqlContainer
    );
    const kafkaHelper = new KafkaHelper(containers.kafkaContainer!);
    await kafkaHelper.initialize();

    return {
      dataSource,
      mysqlContainer: containers.mysqlContainer,
      kafkaContainer: containers.kafkaContainer,
      dataHelper: new DataHelper(dataSource),
      dbHelper: new DbHelper(dataSource),
      kafkaHelper,
    };
  }

  async createAppWithDatabaseAndKafka(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const containers = await this.containerManager.setupMySQLAndKafka(config);
    const kafkaHelper = new KafkaHelper(containers.kafkaContainer!);
    await kafkaHelper.initialize();

    const app = await this.appManager.createApp(
      containers.mysqlContainer,
      containers.kafkaContainer
    );
    const dataSource = app.get(DataSource);

    return {
      app,
      dataSource,
      mysqlContainer: containers.mysqlContainer,
      kafkaContainer: containers.kafkaContainer,
      dataHelper: new DataHelper(dataSource, app),
      dbHelper: new DbHelper(dataSource),
      kafkaHelper,
    };
  }

  async createFullEnvironment(
    config: TestEnvironmentConfig = {}
  ): Promise<TestEnvironment> {
    const containers = await this.containerManager.setupAll(config);
    const dataSource = await this.databaseManager.createDataSource(
      containers.mysqlContainer
    );
    const kafkaHelper = new KafkaHelper(containers.kafkaContainer!);
    await kafkaHelper.initialize();

    return {
      dataSource,
      mysqlContainer: containers.mysqlContainer,
      redisContainer: containers.redisContainer,
      kafkaContainer: containers.kafkaContainer,
      dataHelper: new DataHelper(dataSource),
      dbHelper: new DbHelper(dataSource),
      redisHelper: new RedisHelper(containers.redisContainer!),
      kafkaHelper,
    };
  }

  async cleanup(environment?: TestEnvironment): Promise<void> {
    if (!environment) return;

    const cleanupTasks = [
      environment?.kafkaHelper?.disconnect(),
      environment?.redisHelper?.disconnect(),
      environment?.dataSource?.destroy(),
      environment?.app?.close(),
      environment?.mysqlContainer?.stop(),
      environment?.redisContainer?.stop(),
      environment?.kafkaContainer?.stop(),
    ].filter(Boolean);

    await Promise.allSettled(cleanupTasks as Promise<unknown>[]);
  }
}
