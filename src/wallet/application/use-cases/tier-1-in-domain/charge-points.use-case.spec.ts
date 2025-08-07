import { ChargePointsUseCase } from "./charge-points.use-case";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { InvalidChargeAmountError } from "@/wallet/domain/exceptions/point.exceptions";
import {
  DuplicateIdempotencyKeyError,
  UserBalanceNotFoundError,
} from "@/wallet/application/wallet.application.exceptions";
import { v4 as uuidv4 } from "uuid";

jest.mock("@/wallet/infrastructure/persistence/use-balance.repository");
jest.mock("@/wallet/infrastructure/persistence/point-transaction.repository");
jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
  IsolationLevel: {
    ReadCommitted: Symbol("ReadCommitted"),
  },
}));

jest.mock("@/common/decorators/retry-on-optimistic-lock.decorator", () => ({
  RetryOnOptimisticLock: jest.fn(() => () => {}),
}));

import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { Test } from "@nestjs/testing";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";

describe("ChargePointsUseCase", () => {
  let useCase: ChargePointsUseCase;
  let userBalanceRepository: jest.Mocked<UserBalanceRepository>;
  let pointTransactionRepository: jest.Mocked<PointTransactionRepository>;

  const mockUserId = "test-user-id";

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChargePointsUseCase,
        UserBalanceRepository,
        PointTransactionRepository,
      ],
    }).compile();

    useCase = module.get<ChargePointsUseCase>(ChargePointsUseCase);
    userBalanceRepository = module.get<jest.Mocked<UserBalanceRepository>>(
      UserBalanceRepository
    );
    pointTransactionRepository = module.get<
      jest.Mocked<PointTransactionRepository>
    >(PointTransactionRepository);
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

        userBalanceRepository.findByUserId.mockResolvedValue({
          userBalance: existingBalance,
          metadata: {
            version: 1,
          },
        });

        // when
        const result = await useCase.execute({
          userId: mockUserId,
          amount: chargeAmount,
          idempotencyKey: uuidv4(),
          refId: null,
        });

        // then
        expect(result.userBalance.balance).toBe(currentBalance + chargeAmount);
        expect(result.pointTransaction.amount).toBe(chargeAmount);
        expect(result.pointTransaction.type).toBe("CHARGE");
        expect(result.pointTransaction.userId).toBe(mockUserId);
      });
    }
  );

  it("중복된 idempotencyKey로 요청시 에러가 발생해야 한다", async () => {
    const idempotencyKey = uuidv4();
    userBalanceRepository.findByUserId.mockResolvedValue({
      userBalance: UserBalance.create({
        userId: mockUserId,
        balance: 0,
      }),
      metadata: { version: 1 },
    });
    pointTransactionRepository.findByIdempotencyKey.mockResolvedValue(
      PointTransaction.create({
        userId: mockUserId,
        amount: 1000,
        type: "CHARGE",
        idempotencyKey,
        refId: null,
      })
    );

    await expect(
      useCase.execute({
        userId: mockUserId,
        amount: 1000,
        idempotencyKey,
        refId: null,
      })
    ).rejects.toThrow(DuplicateIdempotencyKeyError);
  });

  it("사용자 잔액을 찾을 수 없을 때 UserBalanceNotFoundError를 던져야한다", async () => {
    // given
    userBalanceRepository.findByUserId.mockResolvedValue(null);

    // when & then
    await expect(
      useCase.execute({
        userId: mockUserId,
        amount: 10000,
        idempotencyKey: uuidv4(),
        refId: null,
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

        userBalanceRepository.findByUserId.mockResolvedValue({
          userBalance: existingBalance,
          metadata: {
            version: 1,
          },
        });

        // when & then
        await expect(
          useCase.execute({
            userId: mockUserId,
            amount: chargeAmount,
            idempotencyKey: uuidv4(),
            refId: null,
          })
        ).rejects.toThrow(InvalidChargeAmountError);
      });
    }
  );
});
