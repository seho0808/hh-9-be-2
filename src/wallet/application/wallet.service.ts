import { Injectable, Inject } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  ChargePointsUseCase,
  ChargePointsUseCaseResult,
} from "../domain/use-cases/charge-points.use-case";
import {
  GetUserPointsUseCase,
  GetUserPointsUseCaseResult,
} from "../domain/use-cases/get-user-points.use-case";
import {
  RecoverPointsUseCase,
  RecoverPointsUseCaseResult,
} from "../domain/use-cases/recover-points.use-case";
import {
  UsePointsUseCase,
  UsePointsUseCaseResult,
} from "../domain/use-cases/use-points.use-case";
import {
  CreateUserBalanceUseCase,
  CreateUserBalanceUseCaseResult,
} from "../domain/use-cases/create-user-balance.use-case";
import {
  ValidateUsePointsUseCase,
  ValidateUsePointsUseCaseResult,
} from "../domain/use-cases/validate-use-points.use-case";
import { UserBalanceRepository } from "../infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "../infrastructure/persistence/point-transaction.repository";

@Injectable()
export class WalletApplicationService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepository,
    @Inject("PointTransactionRepositoryInterface")
    private readonly pointTransactionRepository: PointTransactionRepository,
    private readonly chargePointsUseCase: ChargePointsUseCase,
    private readonly usePointsUseCase: UsePointsUseCase,
    private readonly recoverPointsUseCase: RecoverPointsUseCase,
    private readonly getUserPointsUseCase: GetUserPointsUseCase,
    private readonly createUserBalanceUseCase: CreateUserBalanceUseCase,
    private readonly validateUsePointsUseCase: ValidateUsePointsUseCase
  ) {}

  async chargePoints(
    userId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<ChargePointsUseCaseResult> {
    return await this.executeInTransaction(async () => {
      return await this.chargePointsUseCase.execute({
        userId,
        amount,
        idempotencyKey,
      });
    });
  }

  async usePoints(
    userId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<UsePointsUseCaseResult> {
    return await this.executeInTransaction(async () => {
      return await this.usePointsUseCase.execute({
        userId,
        amount,
        idempotencyKey,
      });
    });
  }

  async recoverPoints(
    userId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<RecoverPointsUseCaseResult> {
    return await this.executeInTransaction(async () => {
      return await this.recoverPointsUseCase.execute({
        userId,
        amount,
        idempotencyKey,
      });
    });
  }

  async getUserPoints(userId: string): Promise<GetUserPointsUseCaseResult> {
    return await this.getUserPointsUseCase.execute({ userId });
  }

  async createUserBalance(
    userId: string
  ): Promise<CreateUserBalanceUseCaseResult> {
    return await this.executeInTransaction(async () => {
      return await this.createUserBalanceUseCase.execute({ userId });
    });
  }

  async validateUsePoints(
    userId: string,
    amount: number
  ): Promise<ValidateUsePointsUseCaseResult> {
    return await this.validateUsePointsUseCase.execute({ userId, amount });
  }

  private async executeInTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.dataSource.transaction(async (manager) => {
      this.userBalanceRepository.setEntityManager(manager);
      this.pointTransactionRepository.setEntityManager(manager);

      try {
        return await operation();
      } finally {
        this.userBalanceRepository.clearEntityManager();
        this.pointTransactionRepository.clearEntityManager();
      }
    });
  }
}
