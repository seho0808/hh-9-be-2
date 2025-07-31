import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../testcontainers-helper";
import { UserBalanceFactory } from "../../src/wallet/infrastructure/persistence/factories/user-balance.factory";
import { PointTransactionFactory } from "../../src/wallet/infrastructure/persistence/factories/point-transaction.factory";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import {
  PointTransactionType,
  PointTransactionTypeOrmEntity,
} from "../../src/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { ChargePointsUseCase } from "../../src/wallet/application/use-cases/tier-1-in-domain/charge-points.use-case";
import { UsePointsUseCase } from "../../src/wallet/application/use-cases/tier-1-in-domain/use-points.use-case";
import { RecoverPointsUseCase } from "../../src/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";
import { WalletModule } from "../../src/wallet/wallet.module";
import {
  UserBalanceNotFoundError,
  InsufficientPointBalanceError,
} from "../../src/wallet/domain/exceptions/point.exceptions";

describe("Wallet Domain Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>;
  let chargePointsUseCase: ChargePointsUseCase;
  let usePointsUseCase: UsePointsUseCase;
  let recoverPointsUseCase: RecoverPointsUseCase;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupWithMySQL();
    dataSource = setup.dataSource;

    // Create module with Wallet module for integration test
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WalletModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
    pointTransactionRepository = dataSource.getRepository(
      PointTransactionTypeOrmEntity
    );

    chargePointsUseCase =
      moduleFixture.get<ChargePointsUseCase>(ChargePointsUseCase);
    usePointsUseCase = moduleFixture.get<UsePointsUseCase>(UsePointsUseCase);
    recoverPointsUseCase =
      moduleFixture.get<RecoverPointsUseCase>(RecoverPointsUseCase);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource);

    // Reset factory counters
    UserBalanceFactory.resetCounter();
    PointTransactionFactory.resetCounter();
  });

  describe("ChargePointsUseCase", () => {
    it("포인트 충전이 성공적으로 처리되어야 함", async () => {
      // Given: 사용자 잔액
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 5000,
        }
      );

      // When: 포인트를 충전
      const command = {
        userId: "user-123",
        amount: 3000,
        idempotencyKey: "charge-key-1",
      };

      const result = await chargePointsUseCase.execute(command);

      // Then: 잔액이 증가하고 거래 기록이 생성되어야 함
      expect(result.userBalance.balance).toBe(8000); // 5000 + 3000
      expect(result.pointTransaction.userId).toBe("user-123");
      expect(result.pointTransaction.amount).toBe(3000);
      expect(result.pointTransaction.type).toBe("CHARGE");

      // DB 검증
      const savedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(savedUserBalance.balance).toBe(8000);

      const savedTransaction = await pointTransactionRepository.findOne({
        where: { idempotencyKey: "charge-key-1" },
      });
      expect(savedTransaction).toBeDefined();
      expect(savedTransaction.amount).toBe(3000);
      expect(savedTransaction.type).toBe("CHARGE");
    });

    it("존재하지 않는 사용자에 대해 예외가 발생해야 함", async () => {
      // Given: 존재하지 않는 사용자

      // When & Then: 사용자 잔액을 찾을 수 없음으로 예외 발생
      const command = {
        userId: "non-existent-user",
        amount: 1000,
        idempotencyKey: "charge-invalid-user",
      };

      await expect(chargePointsUseCase.execute(command)).rejects.toThrow(
        UserBalanceNotFoundError
      );
    });

    it("동일한 idempotencyKey로 중복 충전 시 중복이 방지되어야 함", async () => {
      // Given: 사용자 잔액과 첫 번째 충전
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 2000,
        }
      );

      const command = {
        userId: "user-123",
        amount: 1000,
        idempotencyKey: "duplicate-charge-key",
      };

      // When: 동일한 idempotencyKey로 두 번 충전 시도
      const result1 = await chargePointsUseCase.execute(command);
      expect(result1.userBalance.balance).toBe(3000);

      // Then: 중복 충전이 방지되어야 함
      await expect(chargePointsUseCase.execute(command)).rejects.toThrow();

      // DB 검증 - 잔액이 한 번만 증가했는지 확인
      const savedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(savedUserBalance.balance).toBe(3000);

      // 거래 기록이 하나만 생성되었는지 확인
      const transactions = await pointTransactionRepository.find({
        where: { userId: "user-123", idempotencyKey: "duplicate-charge-key" },
      });
      expect(transactions).toHaveLength(1);
    });
  });

  describe("UsePointsUseCase", () => {
    it("포인트 사용이 성공적으로 처리되어야 함", async () => {
      // Given: 충분한 잔액을 가진 사용자
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 10000,
        }
      );

      // When: 포인트를 사용
      const command = {
        userId: "user-123",
        amount: 3000,
        idempotencyKey: "use-key-1",
      };

      const result = await usePointsUseCase.execute(command);

      // Then: 잔액이 감소하고 거래 기록이 생성되어야 함
      expect(result.userBalance.balance).toBe(7000); // 10000 - 3000
      expect(result.pointTransaction.userId).toBe("user-123");
      expect(result.pointTransaction.amount).toBe(3000);
      expect(result.pointTransaction.type).toBe("USE");

      // DB 검증
      const savedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(savedUserBalance.balance).toBe(7000);

      const savedTransaction = await pointTransactionRepository.findOne({
        where: { idempotencyKey: "use-key-1" },
      });
      expect(savedTransaction).toBeDefined();
      expect(savedTransaction.amount).toBe(3000);
      expect(savedTransaction.type).toBe("USE");
    });

    it("잔액이 부족할 때 예외가 발생해야 함", async () => {
      // Given: 잔액이 부족한 사용자
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 1000,
        }
      );

      // When & Then: 잔액 부족으로 예외 발생
      const command = {
        userId: "user-123",
        amount: 5000, // 잔액(1000)보다 많은 금액
        idempotencyKey: "use-insufficient-key",
      };

      await expect(usePointsUseCase.execute(command)).rejects.toThrow(
        InsufficientPointBalanceError
      );

      // DB 롤백 검증 - 잔액이 변경되지 않아야 함
      const savedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(savedUserBalance.balance).toBe(1000);
    });

    it("존재하지 않는 사용자에 대해 예외가 발생해야 함", async () => {
      // Given: 존재하지 않는 사용자

      // When & Then: 사용자 잔액을 찾을 수 없음으로 예외 발생
      const command = {
        userId: "non-existent-user",
        amount: 1000,
        idempotencyKey: "use-invalid-user",
      };

      await expect(usePointsUseCase.execute(command)).rejects.toThrow(
        UserBalanceNotFoundError
      );
    });
  });

  describe("RecoverPointsUseCase", () => {
    it("포인트 복구가 성공적으로 처리되어야 함", async () => {
      // Given: 포인트가 사용된 후의 잔액
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 7000, // 원래 10000에서 3000 사용 후
        }
      );

      // 이전 사용 거래 기록
      const previousTransaction = await PointTransactionFactory.createAndSave(
        pointTransactionRepository,
        {
          userId: "user-123",
          amount: 3000,
          type: PointTransactionType.USE,
          idempotencyKey: "previous-use-key",
        }
      );

      // When: 포인트를 복구
      const command = {
        userId: "user-123",
        amount: 3000,
        idempotencyKey: "recover-key-1",
      };

      const result = await recoverPointsUseCase.execute(command);

      // Then: 잔액이 복구되고 거래 기록이 생성되어야 함
      expect(result.userBalance.balance).toBe(10000); // 7000 + 3000
      expect(result.pointTransaction.userId).toBe("user-123");
      expect(result.pointTransaction.amount).toBe(3000);
      expect(result.pointTransaction.type).toBe("RECOVER");

      // DB 검증
      const savedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(savedUserBalance.balance).toBe(10000);

      const savedTransaction = await pointTransactionRepository.findOne({
        where: { idempotencyKey: "recover-key-1" },
      });
      expect(savedTransaction).toBeDefined();
      expect(savedTransaction.amount).toBe(3000);
      expect(savedTransaction.type).toBe("RECOVER");
    });

    it("존재하지 않는 사용자에 대해 예외가 발생해야 함", async () => {
      // Given: 존재하지 않는 사용자

      // When & Then: 사용자 잔액을 찾을 수 없음으로 예외 발생
      const command = {
        userId: "non-existent-user",
        amount: 1000,
        idempotencyKey: "recover-invalid-user",
      };

      await expect(recoverPointsUseCase.execute(command)).rejects.toThrow(
        UserBalanceNotFoundError
      );
    });
  });

  describe("Point Transaction Lifecycle Integration", () => {
    it("포인트의 전체 생명주기가 올바르게 관리되어야 함", async () => {
      // Given: 사용자 잔액 생성
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 0,
        }
      );

      // Step 1: 포인트 충전
      const chargeCommand = {
        userId: "user-123",
        amount: 10000,
        idempotencyKey: "lifecycle-charge-key",
      };

      const chargeResult = await chargePointsUseCase.execute(chargeCommand);
      expect(chargeResult.userBalance.balance).toBe(10000);

      // Step 2: 포인트 사용
      const useCommand = {
        userId: "user-123",
        amount: 3000,
        idempotencyKey: "lifecycle-use-key",
      };

      const useResult = await usePointsUseCase.execute(useCommand);
      expect(useResult.userBalance.balance).toBe(7000);

      // Step 3: 포인트 복구
      const recoverCommand = {
        userId: "user-123",
        amount: 3000,
        idempotencyKey: "lifecycle-recover-key",
      };

      const recoverResult = await recoverPointsUseCase.execute(recoverCommand);
      expect(recoverResult.userBalance.balance).toBe(10000);

      // Final DB 검증
      const finalUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(finalUserBalance.balance).toBe(10000);

      // 모든 거래 기록 확인
      const allTransactions = await pointTransactionRepository.find({
        where: { userId: "user-123" },
        order: { createdAt: "ASC" },
      });
      expect(allTransactions).toHaveLength(3);
      expect(allTransactions[0].type).toBe(PointTransactionType.CHARGE);
      expect(allTransactions[1].type).toBe(PointTransactionType.USE);
      expect(allTransactions[2].type).toBe(PointTransactionType.RECOVER);
    });

    it("복잡한 포인트 거래 시나리오가 올바르게 처리되어야 함", async () => {
      // Given: 초기 사용자 잔액
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 5000,
        }
      );

      // 시나리오: 여러 번의 충전과 사용
      const operations = [
        { type: "charge", amount: 2000, expectedBalance: 7000 },
        { type: "use", amount: 1500, expectedBalance: 5500 },
        { type: "charge", amount: 3000, expectedBalance: 8500 },
        { type: "use", amount: 2000, expectedBalance: 6500 },
        { type: "recover", amount: 1000, expectedBalance: 7500 },
      ];

      // 순차적으로 거래 실행
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const command = {
          userId: "user-123",
          amount: op.amount,
          idempotencyKey: `complex-${op.type}-${i}`,
        };

        let result;
        if (op.type === "charge") {
          result = await chargePointsUseCase.execute(command);
        } else if (op.type === "use") {
          result = await usePointsUseCase.execute(command);
        } else if (op.type === "recover") {
          result = await recoverPointsUseCase.execute(command);
        }

        expect(result.userBalance.balance).toBe(op.expectedBalance);
      }

      // Final DB 검증
      const finalUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(finalUserBalance.balance).toBe(7500);

      // 모든 거래 기록 확인
      const allTransactions = await pointTransactionRepository.find({
        where: { userId: "user-123" },
      });
      expect(allTransactions).toHaveLength(5);
    });
  });
});
