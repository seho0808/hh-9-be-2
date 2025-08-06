import { Injectable } from "@nestjs/common";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import {
  UserBalanceNotFoundError,
  DuplicateIdempotencyKeyError,
} from "@/wallet/application/wallet.application.exceptions";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { RetryOnOptimisticLock } from "@/common/decorators/retry-on-optimistic-lock.decorator";
import { IsolationLevel, Transactional } from "typeorm-transactional";

export interface ChargePointsUseCaseCommand {
  userId: string;
  amount: number;
  idempotencyKey: string;
  refId: string | null;
}

export interface ChargePointsUseCaseResult {
  userBalance: UserBalance;
  pointTransaction: PointTransaction;
}

@Injectable()
export class ChargePointsUseCase {
  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly pointTransactionRepository: PointTransactionRepository
  ) {}

  @RetryOnOptimisticLock(5, 50)
  @Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
  async execute(
    command: ChargePointsUseCaseCommand
  ): Promise<ChargePointsUseCaseResult> {
    const { userId, amount, idempotencyKey, refId } = command;

    const existingTransaction =
      await this.pointTransactionRepository.findByIdempotencyKey(
        idempotencyKey
      );
    if (existingTransaction) {
      const { userBalance } =
        await this.userBalanceRepository.findByUserId(userId);
      return { userBalance, pointTransaction: existingTransaction };
    }

    const { userBalance, metadata } =
      await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    userBalance.addBalance(amount);
    const pointTransaction = PointTransaction.create({
      userId,
      amount,
      type: "CHARGE",
      idempotencyKey,
      refId,
    });

    await Promise.all([
      this.userBalanceRepository.saveWithOptimisticLock(
        userBalance,
        metadata.version
      ),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
