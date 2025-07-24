export const TEST_FACTORY_DEFAULTS = {
  ORDER: {
    TOTAL_PRICE: 10000,
    DISCOUNT_PRICE: 0,
    FINAL_PRICE: 10000,
    STATUS: "PENDING" as const,
  },
  ORDER_ITEM: {
    QUANTITY: 1,
    UNIT_PRICE: 10000,
    TOTAL_PRICE: 10000,
  },
} as const;

export const createTestOrderId = (
  timestamp: number,
  counter: number
): string => {
  return `order-${timestamp}-${counter}`;
};

export const createTestOrderItemId = (
  timestamp: number,
  counter: number
): string => {
  return `order-item-${timestamp}-${counter}`;
};

export const createTestIdempotencyKey = (
  timestamp: number,
  counter: number
): string => {
  return `idempotency-${timestamp}-${counter}`;
};
