import { Injectable, Inject } from "@nestjs/common";
import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalance } from "../entities/user-balance.entity";
import {
  InsufficientPointBalanceError,
  UserBalanceNotFoundError,
} from "../exceptions/point.exceptions";
import { PointTransactionRepositoryInterface } from "../interfaces/point-transaction.repository.interface";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository.interface";

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
    private readonly pointTransactionRepository: PointTransactionRepositoryInterface
  ) {}

  async execute(
    command: UsePointsUseCaseCommand
  ): Promise<UsePointsUseCaseResult> {
    const { userId, amount, idempotencyKey } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    if (userBalance.balance < amount) {
      throw new InsufficientPointBalanceError(
        userId,
        userBalance.balance,
        amount
      );
    }

    userBalance.subtractBalance(amount);
    const pointTransaction = PointTransaction.create({
      userId,
      amount,
      type: "USE",
      idempotencyKey,
    });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
