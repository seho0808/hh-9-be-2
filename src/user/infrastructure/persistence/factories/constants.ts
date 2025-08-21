export const TEST_FACTORY_DEFAULTS = {
  USER: {
    PASSWORD: "hashedTestPassword123",
    NAME_PREFIX: "테스트유저",
    EMAIL_DOMAIN: "test.com",
  },
} as const;

export const createTestName = (
  prefix: string,
  timestamp: number,
  id: number
): string => {
  return `${prefix} ${timestamp}-${id}`;
};

export const createTestEmail = (timestamp: number, id: number): string => {
  return `testuser${timestamp}${id}@${TEST_FACTORY_DEFAULTS.USER.EMAIL_DOMAIN}`;
};
