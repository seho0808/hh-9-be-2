import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { TestEnvironmentConfig } from "../test-environment.factory";
import { DEFAULT_CONTAINER_CONFIG } from "../constants";

export interface ContainerSetup {
  mysqlContainer: StartedMySqlContainer;
  redisContainer?: StartedRedisContainer;
}

export class ContainerManager {
  private generateDatabaseName(): string {
    const workerId = process.env.JEST_WORKER_ID || "1";
    return `test_db_${workerId}_${Date.now()}`;
  }

  private createMySQLContainer(
    config: TestEnvironmentConfig
  ): Promise<StartedMySqlContainer> {
    const {
      mysqlVersion = DEFAULT_CONTAINER_CONFIG.mysqlVersion,
      database = this.generateDatabaseName(),
      username = DEFAULT_CONTAINER_CONFIG.username,
      password = DEFAULT_CONTAINER_CONFIG.password,
    } = config;

    return new MySqlContainer(mysqlVersion)
      .withDatabase(database)
      .withUsername(username)
      .withRootPassword(password)
      .withExposedPorts(3306)
      .start();
  }

  private createRedisContainer(
    config: TestEnvironmentConfig
  ): Promise<StartedRedisContainer> {
    const { redisVersion = DEFAULT_CONTAINER_CONFIG.redisVersion } = config;

    return new RedisContainer(redisVersion).withExposedPorts(6379).start();
  }

  async setupMySQL(
    config: TestEnvironmentConfig = {}
  ): Promise<ContainerSetup> {
    const mysqlContainer = await this.createMySQLContainer(config);
    return { mysqlContainer };
  }

  async setupRedis(
    config: TestEnvironmentConfig = {}
  ): Promise<StartedRedisContainer> {
    return this.createRedisContainer(config);
  }

  async setupMySQLAndRedis(
    config: TestEnvironmentConfig = {}
  ): Promise<ContainerSetup> {
    const [mysqlContainer, redisContainer] = await Promise.all([
      this.createMySQLContainer(config),
      this.createRedisContainer(config),
    ]);

    return { mysqlContainer, redisContainer };
  }
}
