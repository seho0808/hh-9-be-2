import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalance } from "../entities/user-balance.entity";
import {
  InsufficientPointBalanceError,
  PointTransactionAlreadyRecoveredError,
  PointTransactionNotFoundError,
} from "../exceptions/point.exceptions";

export class ValidatePointTransactionService {
  validatePointRecovery({
    idempotencyKey,
    existingPointTransaction,
  }: {
    idempotencyKey: string;
    existingPointTransaction: PointTransaction[];
  }): void {
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
  }

  validateUsePoints({
    amount,
    userBalance,
    withThrow = true,
  }: {
    amount: number;
    userBalance: UserBalance;
    withThrow?: boolean;
  }): boolean {
    if (userBalance.balance < amount) {
      if (withThrow) {
        throw new InsufficientPointBalanceError(
          userBalance.userId,
          userBalance.balance,
          amount
        );
      }

      return false;
    }

    return true;
  }
}
