import { UsePointsUseCase } from "./use-points.use-case";
import { UserBalance } from "../entities/user-balance.entity";
import { PointTransaction } from "../entities/point-transaction.entity";
import {
  InsufficientPointBalanceError,
  UserBalanceNotFoundError,
} from "../exceptions/point.exceptions";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository.interface";
import { PointTransactionRepositoryInterface } from "../interfaces/point-transaction.repository.interface";
import { v4 as uuidv4 } from "uuid";

describe("UsePointsUseCase", () => {
  let useCase: UsePointsUseCase;
  let userBalanceRepository: jest.Mocked<UserBalanceRepositoryInterface>;
  let pointTransactionRepository: jest.Mocked<PointTransactionRepositoryInterface>;

  const mockUserId = "test-user-id";

  beforeEach(() => {
    userBalanceRepository = {
      findByUserId: jest.fn(),
      save: jest.fn(),
    };

    pointTransactionRepository = {
      findByUserId: jest.fn(),
      findByOrderIdempotencyKey: jest.fn(),
      save: jest.fn(),
    };

    useCase = new UsePointsUseCase(
      userBalanceRepository,
      pointTransactionRepository
    );
  });

  const validUseTestCases: Array<
    [currentBalance: number, useAmount: number, desc: string]
  > = [
    [1000, 1000, "잔액과 동일한 금액을 사용할 때"],
    [100_000, 1000, "최소 금액(1,000)을 사용할 때"],
    [100_000, 100_000, "큰 금액(100,000)을 사용할 때"],
    [50_000, 25_000, "중간 범위 금액을 사용할 때"],
    [1_000_000_000, 999_999_000, "최대 잔액에서 대부분을 사용할 때"],
  ];

  describe.each(validUseTestCases)(
    "유효한 사용 금액일 때 포인트를 사용할 수 있어야 한다",
    (currentBalance, useAmount, desc) => {
      it(`${desc}`, async () => {
        // given
        const existingBalance = UserBalance.create({
          userId: mockUserId,
          balance: currentBalance,
        });

        userBalanceRepository.findByUserId.mockResolvedValue(existingBalance);

        // when
        const result = await useCase.execute({
          userId: mockUserId,
          amount: useAmount,
          idempotencyKey: uuidv4(),
        });

        // then
        expect(result.userBalance.balance).toBe(currentBalance - useAmount);
        expect(result.pointTransaction.toPersistence().amount).toBe(useAmount);
        expect(result.pointTransaction.toPersistence().type).toBe("USE");
        expect(result.pointTransaction.toPersistence().userId).toBe(mockUserId);
      });
    }
  );

  const invalidUseTestCases: Array<
    [currentBalance: number, useAmount: number, desc: string]
  > = [
    [500, 1000, "잔액보다 큰 금액을 사용하려 할 때"],
    [0, 1000, "잔액이 0일 때 사용하려 할 때"],
    [100_000, 100_001, "잔액보다 1원 더 많은 금액을 사용하려 할 때"],
  ];

  describe.each(invalidUseTestCases)(
    "잔액이 부족할 때 InsufficientPointBalanceError를 던져야한다",
    (currentBalance, useAmount, desc) => {
      it(`${desc}`, async () => {
        // given
        const existingBalance = UserBalance.create({
          userId: mockUserId,
          balance: currentBalance,
        });

        userBalanceRepository.findByUserId.mockResolvedValue(existingBalance);

        // when & then
        await expect(
          useCase.execute({
            userId: mockUserId,
            amount: useAmount,
            idempotencyKey: uuidv4(),
          })
        ).rejects.toThrow(InsufficientPointBalanceError);
      });
    }
  );

  it("사용자 잔액을 찾을 수 없을 때 UserBalanceNotFoundError를 던져야한다", async () => {
    // given
    userBalanceRepository.findByUserId.mockResolvedValue(null);

    // when & then
    await expect(
      useCase.execute({
        userId: mockUserId,
        amount: 10000,
        idempotencyKey: uuidv4(),
      })
    ).rejects.toThrow(UserBalanceNotFoundError);
  });
});
