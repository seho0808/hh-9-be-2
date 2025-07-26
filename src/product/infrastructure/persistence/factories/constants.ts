export const TEST_FACTORY_DEFAULTS = {
  PRODUCT: {
    PRICE: 10000,
    TOTAL_STOCK: 100,
    RESERVED_STOCK: 0,
    IS_ACTIVE: true,
  },
  STOCK_RESERVATION: {
    QUANTITY: 1,
    IS_ACTIVE: true,
    EXPIRATION_TIME: 30000, // 30 seconds
  },
} as const;

export const createTestName = (
  prefix: string,
  timestamp: number,
  id: number
): string => {
  return `테스트 ${prefix} ${timestamp}-${id}`;
};

export const createTestDescription = (
  prefix: string,
  timestamp: number,
  id: number
): string => {
  return `테스트용 ${prefix} ${timestamp}-${id} 설명`;
};
