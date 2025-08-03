import { Injectable, Inject } from "@nestjs/common";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import {
  PointTransactionNotFoundError,
  UserBalanceNotFoundError,
} from "@/wallet/application/wallet.application.exceptions";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { ValidatePointTransactionService } from "@/wallet/domain/services/validate-point-transaction.service";

export interface RecoverPointsUseCaseCommand {
  userId: string;
  amount: number;
  refId: string;
}

export interface RecoverPointsUseCaseResult {
  userBalance: UserBalance;
  pointTransaction: PointTransaction;
}

@Injectable()
export class RecoverPointsUseCase {
  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly pointTransactionRepository: PointTransactionRepository,
    private readonly validatePointTransactionService: ValidatePointTransactionService
  ) {}

  async execute(
    command: RecoverPointsUseCaseCommand
  ): Promise<RecoverPointsUseCaseResult> {
    const { userId, amount, refId } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    const existingPointTransaction =
      await this.pointTransactionRepository.findByRefId(userId, refId);

    const correctTransactionExists = existingPointTransaction.some(
      (pt) => pt.type === "USE" && pt.refId === refId
    );

    if (!correctTransactionExists) {
      throw new PointTransactionNotFoundError(refId);
    }

    this.validatePointTransactionService.validatePointRecovery({
      refId,
      existingPointTransaction,
    });

    userBalance.addBalance(amount);
    const pointTransaction = PointTransaction.create({
      userId,
      amount,
      type: "RECOVER",
      idempotencyKey: null,
      refId,
    });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
