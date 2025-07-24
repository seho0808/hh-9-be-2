import { ChargePointsUseCase } from "./charge-points.use-case";
import { UserBalance } from "../entities/user-balance.entity";
import {
  InvalidChargeAmountError,
  UserBalanceNotFoundError,
} from "../exceptions/point.exception";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository";
import { PointTransactionRepositoryInterface } from "../interfaces/point-transaction.repository";

describe("ChargePointsUseCase", () => {
  let useCase: ChargePointsUseCase;
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

    useCase = new ChargePointsUseCase(
      userBalanceRepository,
      pointTransactionRepository
    );
  });

  const validChargeTestCases: Array<
    [currentBalance: number, chargeAmount: number, desc: string]
  > = [
    [0, 1000, "최소 충전 금액(1,000)을 충전할 때"],
    [0, 100_000, "최대 충전 금액(100,000)을 충전할 때"],
    [999_900_000, 100_000, "최대 잔액(1,000,000,000) 직전까지 충전할 때"],
    [5000, 1010, "충전 단위(10)의 배수로 충전할 때"],
    [0, 50_000, "중간 범위 금액을 0 잔액에서 충전할 때"],
    [500_000, 50_000, "중간 범위 금액을 기존 잔액이 있을 때 충전할 때"],
  ];

  describe.each(validChargeTestCases)(
    "유효한 충전 금액일 때 포인트를 충전할 수 있어야 한다",
    (currentBalance, chargeAmount, desc) => {
      it(`${desc}`, async () => {
        // given
        const existingBalance = UserBalance.create({
          userId: mockUserId,
          balance: currentBalance,
        });

        userBalanceRepository.findByUserId.mockResolvedValue(existingBalance);
        userBalanceRepository.save.mockImplementation((balance) =>
          Promise.resolve(balance)
        );
        pointTransactionRepository.save.mockImplementation((transaction) =>
          Promise.resolve(transaction)
        );

        // when
        const result = await useCase.execute({
          userId: mockUserId,
          amount: chargeAmount,
        });

        // then
        expect(result.userBalance.balance).toBe(currentBalance + chargeAmount);
        expect(result.pointTransaction.toPersistence().amount).toBe(
          chargeAmount
        );
        expect(result.pointTransaction.toPersistence().type).toBe("CHARGE");
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

  const invalidChargeTestCases: Array<
    [currentBalance: number, chargeAmount: number, desc: string]
  > = [
    [5000, 500, "최소 충전 금액(1000) 미만일 때"],
    [5000, 150_000, "최대 충전 금액(100,000) 초과일 때"],
    [999_000_000, 1_000_000, "최대 잔액을 초과하는 충전 금액일 때"],
    [5000, 1001, "충전 단위(10)의 배수가 아닐 때"],
  ];

  describe.each(invalidChargeTestCases)(
    "충전 금액이 유효하지 않을 때 InvalidChargeAmountError를 던져야한다",
    (currentBalance, chargeAmount, desc) => {
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
            amount: chargeAmount,
          })
        ).rejects.toThrow(InvalidChargeAmountError);
      });
    }
  );
});
