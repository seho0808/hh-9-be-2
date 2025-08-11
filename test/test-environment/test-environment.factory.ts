import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { StartedMySqlContainer } from "@testcontainers/mysql";
import { StartedRedisContainer } from "@testcontainers/redis";
import { ContainerManager } from "./managers/container-manager";
import { DatabaseManager } from "./managers/database-manager";
import { AppManager } from "./managers/app-manager";
import { DataHelper } from "./helpers/data-helper";
import { DbHelper } from "./helpers/db-helper";

export interface TestEnvironment {
  app?: INestApplication;
  dataSource: DataSource;
  mysqlContainer: StartedMySqlContainer;
  redisContainer?: StartedRedisContainer;
  dataHelper: DataHelper;
  dbHelper: DbHelper;
}

export interface TestEnvironmentConfig {
  mysqlVersion?: string;
  redisVersion?: string;
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
    };
  }

  async cleanup(environment?: TestEnvironment): Promise<void> {
    if (!environment) return;

    const cleanupTasks = [
      environment?.dataSource?.destroy(),
      environment?.app?.close(),
      environment?.mysqlContainer?.stop(),
      environment?.redisContainer?.stop(),
    ].filter(Boolean);

    await Promise.allSettled(cleanupTasks as Promise<unknown>[]);
  }
}
