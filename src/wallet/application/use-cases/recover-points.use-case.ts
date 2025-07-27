import { Injectable, Inject } from "@nestjs/common";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { UserBalanceNotFoundError } from "@/wallet/domain/exceptions/point.exceptions";
import { PointTransactionRepositoryInterface } from "@/wallet/domain/interfaces/point-transaction.repository.interface";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";
import { RecoverPointsDomainService } from "@/wallet/domain/services/recover-points.service";

export interface RecoverPointsUseCaseCommand {
  userId: string;
  amount: number;
  idempotencyKey: string;
}

export interface RecoverPointsUseCaseResult {
  userBalance: UserBalance;
  pointTransaction: PointTransaction;
}

@Injectable()
export class RecoverPointsUseCase {
  constructor(
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepositoryInterface,
    @Inject("PointTransactionRepositoryInterface")
    private readonly pointTransactionRepository: PointTransactionRepositoryInterface,
    private readonly recoverPointsDomainService: RecoverPointsDomainService
  ) {}

  async execute(
    command: RecoverPointsUseCaseCommand
  ): Promise<RecoverPointsUseCaseResult> {
    const { userId, amount, idempotencyKey } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    const existingPointTransaction =
      await this.pointTransactionRepository.findByOrderIdempotencyKey(
        userId,
        idempotencyKey
      );

    const pointTransaction =
      await this.recoverPointsDomainService.recoverPoints({
        userId,
        amount,
        idempotencyKey,
        existingPointTransaction,
        userBalance,
      });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
