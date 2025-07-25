import { RecoverPointsUseCase } from "./recover-points.use-case";
import { UserBalance } from "../entities/user-balance.entity";
import { PointTransaction } from "../entities/point-transaction.entity";
import {
  PointTransactionAlreadyRecoveredError,
  PointTransactionNotFoundError,
  UserBalanceNotFoundError,
} from "../exceptions/point.exceptions";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository.interface";
import { PointTransactionRepositoryInterface } from "../interfaces/point-transaction.repository.interface";
import { v4 as uuidv4 } from "uuid";

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
      findByOrderIdempotencyKey: jest.fn(),
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
        pointTransactionRepository.findByOrderIdempotencyKey.mockResolvedValue([
          PointTransaction.create({
            userId: mockUserId,
            amount: recoverAmount,
            type: "USE",
            idempotencyKey: "test-idempotency-key",
          }),
        ]);

        // when
        const result = await useCase.execute({
          userId: mockUserId,
          amount: recoverAmount,
          idempotencyKey: "test-idempotency-key",
        });

        // then
        expect(result.userBalance.balance).toBe(currentBalance + recoverAmount);
        expect(result.pointTransaction.amount).toBe(recoverAmount);
        expect(result.pointTransaction.type).toBe("RECOVER");
        expect(result.pointTransaction.userId).toBe(mockUserId);
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

  it("기존 트랜잭션 중 사용 트랜잭션을 찾을 수 없을 때 PointTransactionNotFoundError를 던져야한다", async () => {
    // given
    userBalanceRepository.findByUserId.mockResolvedValue(
      UserBalance.create({
        userId: mockUserId,
        balance: 10000,
      })
    );
    pointTransactionRepository.findByOrderIdempotencyKey.mockResolvedValue([]);

    // when & then
    await expect(
      useCase.execute({
        userId: mockUserId,
        amount: 10000,
        idempotencyKey: uuidv4(),
      })
    ).rejects.toThrow(PointTransactionNotFoundError);
  });

  it("기존 트랜잭션 중 복구 트랜잭션을 찾을 수 있을 때 PointTransactionAlreadyRecoveredError를 던져야한다", async () => {
    // given
    userBalanceRepository.findByUserId.mockResolvedValue(
      UserBalance.create({
        userId: mockUserId,
        balance: 10000,
      })
    );
    pointTransactionRepository.findByOrderIdempotencyKey.mockResolvedValue([
      PointTransaction.create({
        userId: mockUserId,
        amount: 10000,
        type: "USE",
        idempotencyKey: "test-idempotency-key",
      }),
      PointTransaction.create({
        userId: mockUserId,
        amount: 10000,
        type: "RECOVER",
        idempotencyKey: "test-idempotency-key",
      }),
    ]);

    // when & then
    await expect(
      useCase.execute({
        userId: mockUserId,
        amount: 10000,
        idempotencyKey: "test-idempotency-key",
      })
    ).rejects.toThrow(PointTransactionAlreadyRecoveredError);
  });
});
