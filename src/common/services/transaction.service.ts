import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

export interface RepositoryWithTransaction {
  setEntityManager(manager: EntityManager): void;
  clearEntityManager(): void;
}

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  async executeInTransaction<T>(
    repositories: RepositoryWithTransaction[],
    operation: (manager?: EntityManager) => Promise<T>,
    parentManager?: EntityManager
  ): Promise<T> {
    if (parentManager) {
      repositories.forEach((repo) => repo.setEntityManager(parentManager));

      try {
        return await operation(parentManager);
      } finally {
        repositories.forEach((repo) => repo.clearEntityManager());
      }
    }

    return await this.dataSource.transaction(async (manager) => {
      repositories.forEach((repo) => repo.setEntityManager(manager));

      try {
        return await operation(manager);
      } finally {
        repositories.forEach((repo) => repo.clearEntityManager());
      }
    });
  }
}
