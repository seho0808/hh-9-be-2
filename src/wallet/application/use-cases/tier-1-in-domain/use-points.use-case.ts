import { Injectable } from "@nestjs/common";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import {
  DuplicateIdempotencyKeyError,
  UserBalanceNotFoundError,
} from "@/wallet/application/wallet.application.exceptions";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { ValidatePointTransactionService } from "@/wallet/domain/services/validate-point-transaction.service";

export interface UsePointsUseCaseCommand {
  userId: string;
  amount: number;
  refId: string;
  idempotencyKey: string;
}

export interface UsePointsUseCaseResult {
  userBalance: UserBalance;
  pointTransaction: PointTransaction;
}

@Injectable()
export class UsePointsUseCase {
  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly pointTransactionRepository: PointTransactionRepository,
    private readonly validatePointTransactionService: ValidatePointTransactionService
  ) {}

  async execute(
    command: UsePointsUseCaseCommand
  ): Promise<UsePointsUseCaseResult> {
    const { userId, amount, refId, idempotencyKey } = command;

    const existingTransaction =
      await this.pointTransactionRepository.findByIdempotencyKey(
        idempotencyKey
      );
    if (existingTransaction) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey);
    }

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    this.validatePointTransactionService.validateUsePoints({
      amount,
      userBalance,
    });

    userBalance.subtractBalance(amount);
    const pointTransaction = PointTransaction.create({
      userId,
      amount,
      type: "USE",
      idempotencyKey,
      refId,
    });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
