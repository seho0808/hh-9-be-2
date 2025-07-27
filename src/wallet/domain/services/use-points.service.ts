import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalance } from "../entities/user-balance.entity";
import { InsufficientPointBalanceError } from "../exceptions/point.exceptions";

export class UsePointsDomainService {
  async usePoints({
    userId,
    amount,
    idempotencyKey,
    userBalance,
  }: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    userBalance: UserBalance;
  }): Promise<PointTransaction> {
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

    return pointTransaction;
  }
}
