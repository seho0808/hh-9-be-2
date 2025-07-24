import { RecoverPointsUseCase } from "./recover-points.use-case";
import { UserBalance } from "../entities/user-balance.entity";
import { PointTransaction } from "../entities/point-transaction.entity";
import { UserBalanceNotFoundError } from "../exceptions/point.exceptions";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository";
import { PointTransactionRepositoryInterface } from "../interfaces/point-transaction.repository";

describe("RecoverPointsUseCase", () => {
  let useCase: RecoverPointsUseCase;
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
      save: jest.fn(),
    };

    useCase = new RecoverPointsUseCase(
      userBalanceRepository,
      pointTransactionRepository
    );
  });

  const validRecoverTestCases: Array<
    [currentBalance: number, recoverAmount: number, desc: string]
  > = [
    [0, 1000, "최소 금액(1,000)을 복구할 때"],
    [0, 100_000, "큰 금액(100,000)을 복구할 때"],
    [0, 50_000, "중간 범위 금액을 0 잔액에서 복구할 때"],
    [500_000, 50_000, "중간 범위 금액을 기존 잔액이 있을 때 복구할 때"],
    [999_900_000, 100_000, "최대 잔액(1,000,000,000) 직전까지 복구할 때"],
  ];

  describe.each(validRecoverTestCases)(
    "유효한 복구 금액일 때 포인트를 복구할 수 있어야 한다",
    (currentBalance, recoverAmount, desc) => {
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
          amount: recoverAmount,
        });

        // then
        expect(result.userBalance.balance).toBe(currentBalance + recoverAmount);
        expect(result.pointTransaction.toPersistence().amount).toBe(
          recoverAmount
        );
        expect(result.pointTransaction.toPersistence().type).toBe("RECOVER");
        expect(result.pointTransaction.toPersistence().userId).toBe(mockUserId);
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
      })
    ).rejects.toThrow(UserBalanceNotFoundError);
  });
});
