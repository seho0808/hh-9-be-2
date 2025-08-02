import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalance } from "../entities/user-balance.entity";
import {
  InsufficientPointBalanceError,
  PointTransactionAlreadyRecoveredError,
  PointTransactionNotFoundError,
} from "../exceptions/point.exceptions";

export class ValidatePointTransactionService {
  validatePointRecovery({
    refId,
    existingPointTransaction,
  }: {
    refId: string;
    existingPointTransaction: PointTransaction[];
  }): void {
    const correctTransactionExists = existingPointTransaction.some(
      (pt) => pt.type === "USE" && pt.refId === refId
    );
    const isAlreadyRecovered = existingPointTransaction.some(
      (pt) => pt.type === "RECOVER" && pt.refId === refId
    );

    if (!correctTransactionExists) {
      throw new PointTransactionNotFoundError(refId);
    }

    if (isAlreadyRecovered) {
      throw new PointTransactionAlreadyRecoveredError(refId);
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
