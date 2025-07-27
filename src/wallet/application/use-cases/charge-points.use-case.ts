import { Injectable, Inject } from "@nestjs/common";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { UserBalanceNotFoundError } from "@/wallet/domain/exceptions/point.exceptions";
import { PointTransactionRepositoryInterface } from "@/wallet/domain/interfaces/point-transaction.repository.interface";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";

export interface ChargePointsUseCaseCommand {
  userId: string;
  amount: number;
  idempotencyKey: string;
}

export interface ChargePointsUseCaseResult {
  userBalance: UserBalance;
  pointTransaction: PointTransaction;
}

@Injectable()
export class ChargePointsUseCase {
  constructor(
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepositoryInterface,
    @Inject("PointTransactionRepositoryInterface")
    private readonly pointTransactionRepository: PointTransactionRepositoryInterface
  ) {}

  async execute(
    command: ChargePointsUseCaseCommand
  ): Promise<ChargePointsUseCaseResult> {
    const { userId, amount, idempotencyKey } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    userBalance.addBalance(amount);
    const pointTransaction = PointTransaction.create({
      userId,
      amount,
      type: "CHARGE",
      idempotencyKey,
    });

    await Promise.all([
      this.userBalanceRepository.save(userBalance),
      this.pointTransactionRepository.save(pointTransaction),
    ]);

    return { userBalance, pointTransaction };
  }
}
