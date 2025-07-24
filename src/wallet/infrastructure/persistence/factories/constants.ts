export const TEST_FACTORY_DEFAULTS = {
  USER_BALANCE: {
    BALANCE: 10000,
  },
  POINT_TRANSACTION: {
    AMOUNT: 5000,
    TYPE: "CHARGE" as const,
  },
};

export function createTestTransactionId(
  timestamp: number,
  counter: number
): string {
  return `transaction-${timestamp}-${counter}`;
}

export function createTestBalanceId(
  timestamp: number,
  counter: number
): string {
  return `balance-${timestamp}-${counter}`;
}
