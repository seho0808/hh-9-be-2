import { DataSource } from "typeorm";
import { TABLE_NAMES } from "../constants";

export class DbHelper {
  constructor(private readonly dataSource: DataSource) {}

  async clearDatabase(): Promise<void> {
    await this.dataSource.query("SET FOREIGN_KEY_CHECKS = 0");
    await Promise.all(
      TABLE_NAMES.map((tableName) =>
        this.dataSource.query(`DELETE FROM ${tableName}`).catch(() => {})
      )
    );
    await this.dataSource.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.dataSource.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async getTableInfo(tableName: string): Promise<any[]> {
    return this.dataSource.query(`DESCRIBE ${tableName}`);
  }
}
