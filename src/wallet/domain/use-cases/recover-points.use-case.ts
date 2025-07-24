import { Injectable, Inject } from "@nestjs/common";
import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalance } from "../entities/user-balance.entity";
import {
  PointTransactionAlreadyRecoveredError,
  PointTransactionNotFoundError,
  UserBalanceNotFoundError,
} from "../exceptions/point.exceptions";
import { PointTransactionRepositoryInterface } from "../interfaces/point-transaction.repository";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository";

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
    private readonly pointTransactionRepository: PointTransactionRepositoryInterface
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

    const correctTransactionExists = existingPointTransaction.some(
      (pt) => pt.type === "USE" && pt.idempotencyKey === idempotencyKey
    );
    const isAlreadyRecovered = existingPointTransaction.some(
      (pt) => pt.type === "RECOVER" && pt.idempotencyKey === idempotencyKey
    );

    if (!correctTransactionExists) {
      throw new PointTransactionNotFoundError(idempotencyKey);
    }

    if (isAlreadyRecovered) {
      throw new PointTransactionAlreadyRecoveredError(idempotencyKey);
    }

    userBalance.addBalance(amount);
    const pointTransaction = PointTransaction.create({
      userId,
      amount,
      type: "RECOVER",
      idempotencyKey,
    });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
