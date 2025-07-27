import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalance } from "../entities/user-balance.entity";
import {
  PointTransactionAlreadyRecoveredError,
  PointTransactionNotFoundError,
} from "../exceptions/point.exceptions";

export class RecoverPointsDomainService {
  async recoverPoints({
    userId,
    amount,
    idempotencyKey,
    existingPointTransaction,
    userBalance,
  }: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    existingPointTransaction: PointTransaction[];
    userBalance: UserBalance;
  }): Promise<PointTransaction> {
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

    return pointTransaction;
  }
}
