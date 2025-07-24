export const TEST_FACTORY_DEFAULTS = {
  COUPON: {
    DISCOUNT_TYPE: "FIXED",
    DISCOUNT_VALUE: 10000,
    MINIMUM_ORDER_PRICE: 50000,
    MAX_DISCOUNT_PRICE: null,
    TOTAL_COUNT: 100,
    EXPIRES_IN_DAYS: 7,
  },
  USER_COUPON: {
    STATUS: "ISSUED",
    EXPIRES_IN_DAYS: 7,
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

export const createTestCouponCode = (timestamp: number, id: number): string => {
  return `TEST${timestamp}${id}`;
};
