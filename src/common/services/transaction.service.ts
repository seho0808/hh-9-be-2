import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

export interface RepositoryWithTransaction {
  setEntityManager(manager: EntityManager): void;
  clearEntityManager(): void;
}

export class TransactionContext {
  private static instance: TransactionContext;
  private static entityManager: EntityManager | null = null;
  private static repositories: Set<RepositoryWithTransaction> = new Set();

  static getInstance(): TransactionContext {
    if (!this.instance) {
      this.instance = new TransactionContext();
    }
    return this.instance;
  }

  static setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
    this.repositories.forEach((repo) => repo.setEntityManager(manager));
  }

  static clearEntityManager(): void {
    this.repositories.forEach((repo) => repo.clearEntityManager());
    this.entityManager = null;
  }

  static getEntityManager(): EntityManager | null {
    return this.entityManager;
  }

  static registerRepository(repository: RepositoryWithTransaction): void {
    this.repositories.add(repository);
    if (this.entityManager) {
      repository.setEntityManager(this.entityManager);
    }
  }

  static unregisterRepository(repository: RepositoryWithTransaction): void {
    this.repositories.delete(repository);
  }
}

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  async runWithTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
    parentManager?: EntityManager
  ): Promise<T> {
    if (parentManager) {
      TransactionContext.setEntityManager(parentManager);
      try {
        return await operation(parentManager);
      } finally {
        TransactionContext.clearEntityManager();
      }
    }

    return await this.dataSource.transaction(async (manager) => {
      TransactionContext.setEntityManager(manager);
      try {
        return await operation(manager);
      } finally {
        TransactionContext.clearEntityManager();
      }
    });
  }
}
