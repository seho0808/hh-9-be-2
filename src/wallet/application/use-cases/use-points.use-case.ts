import { Injectable, Inject } from "@nestjs/common";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import {
  InsufficientPointBalanceError,
  UserBalanceNotFoundError,
} from "@/wallet/domain/exceptions/point.exceptions";
import { PointTransactionRepositoryInterface } from "@/wallet/domain/interfaces/point-transaction.repository.interface";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";
import { UsePointsDomainService } from "@/wallet/domain/services/use-points.service";

export interface UsePointsUseCaseCommand {
  userId: string;
  amount: number;
  idempotencyKey: string;
}

export interface UsePointsUseCaseResult {
  userBalance: UserBalance;
  pointTransaction: PointTransaction;
}

@Injectable()
export class UsePointsUseCase {
  constructor(
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepositoryInterface,
    @Inject("PointTransactionRepositoryInterface")
    private readonly pointTransactionRepository: PointTransactionRepositoryInterface,
    private readonly usePointsDomainService: UsePointsDomainService
  ) {}

  async execute(
    command: UsePointsUseCaseCommand
  ): Promise<UsePointsUseCaseResult> {
    const { userId, amount, idempotencyKey } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    const pointTransaction = await this.usePointsDomainService.usePoints({
      userId,
      amount,
      idempotencyKey,
      userBalance,
    });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
