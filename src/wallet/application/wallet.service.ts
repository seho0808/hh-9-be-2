import { Injectable } from "@nestjs/common";
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

@Injectable()
export class WalletApplicationService {
  constructor(
    private readonly chargePointsUseCase: ChargePointsUseCase,
    private readonly usePointsUseCase: UsePointsUseCase,
    private readonly recoverPointsUseCase: RecoverPointsUseCase,
    private readonly getUserPointsUseCase: GetUserPointsUseCase,
    private readonly createUserBalanceUseCase: CreateUserBalanceUseCase
  ) {}

  async chargePoints(
    userId: string,
    amount: number
  ): Promise<ChargePointsUseCaseResult> {
    // TODO: 외부 결제 api 검증 호출
    const result = await this.chargePointsUseCase.execute({
      userId,
      amount,
    }); // TODO: 트랜잭션으로 묶어서 동시에 outbox payment 테이블에 등록 => 외부/다른곳에서 알아서 비동기로 결제 호출
    return result;
  }

  async usePoints(
    userId: string,
    amount: number
  ): Promise<UsePointsUseCaseResult> {
    const result = await this.usePointsUseCase.execute({
      userId,
      amount,
    });

    return result;
  }

  async recoverPoints(
    userId: string,
    amount: number
  ): Promise<RecoverPointsUseCaseResult> {
    const result = await this.recoverPointsUseCase.execute({
      userId,
      amount,
    });

    return result;
  }

  async getUserPoints(userId: string): Promise<GetUserPointsUseCaseResult> {
    const result = await this.getUserPointsUseCase.execute({ userId });
    return result;
  }

  async createUserBalance(
    userId: string
  ): Promise<CreateUserBalanceUseCaseResult> {
    const result = await this.createUserBalanceUseCase.execute({ userId });
    return result;
  }
}
