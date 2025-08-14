import { DataSource } from "typeorm";
import { StartedMySqlContainer } from "@testcontainers/mysql";
import {
  initializeTransactionalContext,
  addTransactionalDataSource,
} from "typeorm-transactional";
import { ALL_ENTITIES, TABLE_NAMES } from "../constants";

export class DatabaseManager {
  private createDataSourceConfig(container: StartedMySqlContainer) {
    return {
      type: "mysql" as const,
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getUserPassword(),
      database: container.getDatabase(),
      entities: ALL_ENTITIES,
      synchronize: true,
      dropSchema: true,
      logging: false,
    };
  }

  async createDataSource(
    container: StartedMySqlContainer
  ): Promise<DataSource> {
    initializeTransactionalContext();

    const dataSource = new DataSource(this.createDataSourceConfig(container));
    await dataSource.initialize();
    addTransactionalDataSource(dataSource);
    return dataSource;
  }
}
