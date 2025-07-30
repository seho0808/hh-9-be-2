import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import {
  ChargePointsUseCase,
  ChargePointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/charge-points.use-case";
import {
  GetUserPointsUseCase,
  GetUserPointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/get-user-points.use-case";
import {
  RecoverPointsUseCase,
  RecoverPointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";
import {
  UsePointsUseCase,
  UsePointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/use-points.use-case";
import {
  CreateUserBalanceUseCase,
  CreateUserBalanceUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/create-user-balance.use-case";
import {
  ValidateUsePointsUseCase,
  ValidateUsePointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/validate-use-points.use-case";
import { TransactionService } from "@/common/services/transaction.service";

@Injectable()
export class WalletApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
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
    return await this.transactionService.runWithTransaction(async (manager) => {
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
    idempotencyKey: string,
    parentManager?: EntityManager
  ): Promise<UsePointsUseCaseResult> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.usePointsUseCase.execute({
        userId,
        amount,
        idempotencyKey,
      });
    }, parentManager);
  }

  async recoverPoints(
    userId: string,
    amount: number,
    idempotencyKey: string,
    parentManager?: EntityManager
  ): Promise<RecoverPointsUseCaseResult> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.recoverPointsUseCase.execute({
        userId,
        amount,
        idempotencyKey,
      });
    }, parentManager);
  }

  async getUserPoints(userId: string): Promise<GetUserPointsUseCaseResult> {
    return await this.getUserPointsUseCase.execute({ userId });
  }

  async createUserBalance(
    userId: string
  ): Promise<CreateUserBalanceUseCaseResult> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.createUserBalanceUseCase.execute({ userId });
    });
  }

  async validateUsePoints(
    userId: string,
    amount: number
  ): Promise<ValidateUsePointsUseCaseResult> {
    return await this.validateUsePointsUseCase.execute({ userId, amount });
  }
}
