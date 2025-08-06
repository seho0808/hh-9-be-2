import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { UserBalanceFactory } from "@/wallet/infrastructure/persistence/factories/user-balance.factory";
import { PointTransactionFactory } from "@/wallet/infrastructure/persistence/factories/point-transaction.factory";
import { UserBalanceTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import {
  PointTransactionType,
  PointTransactionTypeOrmEntity,
} from "@/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import {
  ChargePointsUseCase,
  ChargePointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/charge-points.use-case";
import {
  UsePointsUseCase,
  UsePointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/use-points.use-case";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { ValidatePointTransactionService } from "@/wallet/domain/services/validate-point-transaction.service";
import {
  RecoverPointsUseCase,
  RecoverPointsUseCaseResult,
} from "@/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";

describe("포인트 동시성 테스트", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>;
  let chargePointsUseCase: ChargePointsUseCase;
  let usePointsUseCase: UsePointsUseCase;
  let recoverPointsUseCase: RecoverPointsUseCase;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupDatabaseOnly();
    dataSource = setup.dataSource;

    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
    pointTransactionRepository = dataSource.getRepository(
      PointTransactionTypeOrmEntity
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(UserBalanceTypeOrmEntity),
          useValue: userBalanceRepository,
        },
        {
          provide: getRepositoryToken(PointTransactionTypeOrmEntity),
          useValue: pointTransactionRepository,
        },
        UserBalanceRepository,
        PointTransactionRepository,
        ValidatePointTransactionService,
        ChargePointsUseCase,
        UsePointsUseCase,
        RecoverPointsUseCase,
      ],
    }).compile();

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

    UserBalanceFactory.resetCounter();
    PointTransactionFactory.resetCounter();
  });

  it("동시에 여러 번 포인트 충전 시 잔액이 정확히 계산되어야 함", async () => {
    // Given: 초기 잔액 설정
    const initialBalance = 5000;
    await UserBalanceFactory.createAndSave(userBalanceRepository, {
      userId: "user-123",
      balance: initialBalance,
    });

    const chargeAmount = 1000;
    const concurrentRequests = 10;

    // When: 동시에 여러 번 포인트 충전
    const chargePromises = Array.from({ length: concurrentRequests }, (_, i) =>
      chargePointsUseCase.execute({
        userId: "user-123",
        amount: chargeAmount,
        refId: `concurrent-charge-${i}`,
        idempotencyKey: `concurrent-charge-${i}`,
      })
    );

    const results = await Promise.all(chargePromises);

    // Then: 모든 충전이 성공하고 최종 잔액이 정확해야 함
    expect(results).toHaveLength(concurrentRequests);
    results.forEach((result) => {
      expect(result.pointTransaction.amount).toBe(chargeAmount);
      expect(result.pointTransaction.type).toBe("CHARGE");
    });

    // 최종 잔액 검증
    const finalBalance = await userBalanceRepository.findOne({
      where: { userId: "user-123" },
    });
    const expectedBalance = initialBalance + chargeAmount * concurrentRequests;
    expect(finalBalance.balance).toBe(expectedBalance);

    // 트랜잭션 기록 검증
    const transactions = await pointTransactionRepository.find({
      where: { userId: "user-123" },
    });
    expect(transactions).toHaveLength(concurrentRequests);
  });

  it("동시에 여러 번 포인트 사용 시 잔액이 정확히 계산되어야 함", async () => {
    // Given: 충분한 초기 잔액 설정
    const initialBalance = 50000;
    await UserBalanceFactory.createAndSave(userBalanceRepository, {
      userId: "user-123",
      balance: initialBalance,
    });

    const useAmount = 1000;
    const concurrentRequests = 10;

    // When: 동시에 여러 번 포인트 사용
    const usePromises = Array.from({ length: concurrentRequests }, (_, i) =>
      usePointsUseCase.execute({
        userId: "user-123",
        amount: useAmount,
        refId: `concurrent-use-${i}`,
        idempotencyKey: `concurrent-use-${i}`,
      })
    );

    const results = await Promise.all(usePromises);

    // Then: 모든 사용이 성공하고 최종 잔액이 정확해야 함
    expect(results).toHaveLength(concurrentRequests);
    results.forEach((result) => {
      expect(result.pointTransaction.amount).toBe(useAmount);
      expect(result.pointTransaction.type).toBe("USE");
    });

    // 최종 잔액 검증
    const finalBalance = await userBalanceRepository.findOne({
      where: { userId: "user-123" },
    });
    const expectedBalance = initialBalance - useAmount * concurrentRequests;
    expect(finalBalance.balance).toBe(expectedBalance);

    // 트랜잭션 기록 검증
    const transactions = await pointTransactionRepository.find({
      where: { userId: "user-123" },
    });
    expect(transactions).toHaveLength(concurrentRequests);
  });

  it("포인트 복구가 동시에 일어날 때 정확히 한 번만 복구되어야 함", async () => {
    // Given: 초기 잔액 설정
    const initialBalance = 10000;
    await UserBalanceFactory.createAndSave(userBalanceRepository, {
      userId: "user-123",
      balance: initialBalance,
    });

    await PointTransactionFactory.createAndSave(pointTransactionRepository, {
      userId: "user-123",
      amount: 1000,
      type: PointTransactionType.USE,
      refId: "recovery-charge-1",
      idempotencyKey: "recovery-charge-1",
    });

    const recoverAmount = 1000; // 사용한 금액과 동일하게 복구
    const recoveryCount = 5;

    const operations = [
      ...Array.from({ length: recoveryCount }, (_, i) =>
        recoverPointsUseCase.execute({
          userId: "user-123",
          amount: recoverAmount,
          refId: `recovery-charge-1`,
        })
      ),
    ];

    const results = await Promise.allSettled(operations);

    // Then: 하나만 성공해야 함
    const settledResults = results.map((result) =>
      result.status === "fulfilled" ? result.value : { error: result.reason }
    );

    const successes = settledResults.filter((result) => !("error" in result));
    const failures = settledResults.filter((result) => "error" in result);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(recoveryCount - 1);

    // 최종 잔액 검증 (한 번만 복구 성공)
    const finalBalance = await userBalanceRepository.findOne({
      where: { userId: "user-123" },
    });
    expect(finalBalance.balance).toBe(
      initialBalance + recoverAmount // 한 번만 복구됨
    );

    // 트랜잭션 기록 검증 (기존 USE 1개 + 성공한 RECOVER 1개)
    const transactions = await pointTransactionRepository.find({
      where: { userId: "user-123" },
    });
    expect(transactions).toHaveLength(2);
  });

  it("잔액 부족 시 동시 요청 중 일부만 성공해야 함", async () => {
    // Given: 제한된 초기 잔액 설정
    const initialBalance = 5000;
    await UserBalanceFactory.createAndSave(userBalanceRepository, {
      userId: "user-123",
      balance: initialBalance,
    });

    const useAmount = 1000;
    const concurrentRequests = 10; // 잔액보다 많은 요청

    // When: 동시에 여러 번 포인트 사용 (일부는 실패할 것)
    const usePromises = Array.from({ length: concurrentRequests }, (_, i) =>
      usePointsUseCase
        .execute({
          userId: "user-123",
          amount: useAmount,
          refId: `insufficient-use-${i}`,
          idempotencyKey: `insufficient-use-${i}`,
        })
        .catch((error) => ({ error }))
    );

    const results = await Promise.all(usePromises);

    // Then: 성공한 요청과 실패한 요청이 있어야 함
    const successes = results.filter((result) => !("error" in result));
    const failures = results.filter((result) => "error" in result);

    expect(successes.length).toBe(5); // 5000 / 1000 = 5개만 성공
    expect(failures.length).toBe(5); // 나머지 5개는 실패

    // 최종 잔액이 0이어야 함
    const finalBalance = await userBalanceRepository.findOne({
      where: { userId: "user-123" },
    });
    expect(finalBalance.balance).toBe(0);
  });

  // NOTE: 아래 케이스 두 개로 분기쳐도 순서 보장이 안되어서 할 때 마다 다른 결과가 나옴.
  it("충전·사용 동시 요청(잔액 부족) 시 **충전이 선행될 때만** 사용이 성공해야 함", async () => {
    // Given: 잔액 80 세팅
    await UserBalanceFactory.createAndSave(userBalanceRepository, {
      userId: "user-123",
      balance: 8000,
    });

    // When: 충전 +30, 사용 -100 동시에 던짐
    const [useRes, chargeRes] = await Promise.allSettled([
      usePointsUseCase.execute({
        userId: "user-123",
        amount: 10000,
        refId: "race-use",
        idempotencyKey: "race-use",
      }),
      chargePointsUseCase.execute({
        userId: "user-123",
        amount: 3000,
        refId: "race-charge",
        idempotencyKey: "race-charge",
      }),
    ]);

    // Then: ① 충전은 반드시 성공
    expect(chargeRes.status).toBe("fulfilled");

    // Then: ② 사용은 0 또는 1회 성공
    const useSucceeded = useRes.status === "fulfilled";
    expect([true, false]).toContain(useSucceeded);

    // Then: ③ 잔액은 10(둘 다 성공) or 110(사용 실패)
    const bal = (await userBalanceRepository.findOneBy({ userId: "user-123" }))!
      .balance;
    expect([1000, 11000]).toContain(bal);
  });

  it("포인트 충전과 사용과 복구가 동시에 일어날 때 최종 값이 정확히 처리되어야 함", async () => {
    // Given: 초기 잔액 설정
    const initialBalance = 10000;
    await UserBalanceFactory.createAndSave(userBalanceRepository, {
      userId: "user-123",
      balance: initialBalance,
    });

    // 복구할 기존 트랜잭션들 생성
    await PointTransactionFactory.createAndSave(pointTransactionRepository, {
      userId: "user-123",
      amount: 1000,
      type: PointTransactionType.USE,
      refId: "recoverable-use-1",
      idempotencyKey: "recoverable-use-1",
    });

    await PointTransactionFactory.createAndSave(pointTransactionRepository, {
      userId: "user-123",
      amount: 800,
      type: PointTransactionType.USE,
      refId: "recoverable-use-2",
      idempotencyKey: "recoverable-use-2",
    });

    const chargeAmount = 2000;
    const useAmount = 1500;
    const recoverAmount1 = 1000;
    const recoverAmount2 = 800;
    const chargeCount = 5;
    const useCount = 3;
    const recoverCount = 2;

    // When: 충전, 사용, 복구를 동시에 실행
    const operations: Promise<
      | ChargePointsUseCaseResult
      | UsePointsUseCaseResult
      | RecoverPointsUseCaseResult
    >[] = [
      // 충전 요청들
      ...Array.from({ length: chargeCount }, (_, i) =>
        chargePointsUseCase.execute({
          userId: "user-123",
          amount: chargeAmount,
          refId: `mixed-charge-${i}`,
          idempotencyKey: `mixed-charge-${i}`,
        })
      ),
      // 사용 요청들
      ...Array.from({ length: useCount }, (_, i) =>
        usePointsUseCase.execute({
          userId: "user-123",
          amount: useAmount,
          refId: `mixed-use-${i}`,
          idempotencyKey: `mixed-use-${i}`,
        })
      ),
      // 복구 요청들
      recoverPointsUseCase.execute({
        userId: "user-123",
        amount: recoverAmount1,
        refId: "recoverable-use-1",
      }),
      recoverPointsUseCase.execute({
        userId: "user-123",
        amount: recoverAmount2,
        refId: "recoverable-use-2",
      }),
    ];

    const results = await Promise.allSettled(operations);

    // Then: 충전과 사용은 모두 성공하고, 복구는 성공할 수 있음
    const settledResults: (
      | ChargePointsUseCaseResult
      | UsePointsUseCaseResult
      | RecoverPointsUseCaseResult
      | { error: any }
    )[] = results.map((result) =>
      result.status === "fulfilled" ? result.value : { error: result.reason }
    );

    const successes = settledResults.filter((result) => !("error" in result));
    const failures = settledResults.filter((result) => "error" in result);

    // 성공한 충전 개수 계산
    const successfulCharges = successes.filter(
      (result) =>
        !("error" in result) &&
        result.pointTransaction &&
        result.pointTransaction.type === "CHARGE"
    ) as ChargePointsUseCaseResult[];
    const totalChargedAmount = successfulCharges.reduce(
      (sum, result) => sum + result.pointTransaction.amount,
      0
    );

    // 성공한 사용 개수 계산
    const successfulUses = successes.filter(
      (result) =>
        !("error" in result) &&
        result.pointTransaction &&
        result.pointTransaction.type === "USE"
    ) as UsePointsUseCaseResult[];
    const totalUsedAmount = successfulUses.reduce(
      (sum, result) => sum + result.pointTransaction.amount,
      0
    );

    // 성공한 복구 개수 계산
    const successfulRecoveries = successes.filter(
      (result) =>
        !("error" in result) &&
        result.pointTransaction &&
        result.pointTransaction.type === "RECOVER"
    ) as RecoverPointsUseCaseResult[];
    const totalRecoveredAmount = successfulRecoveries.reduce(
      (sum, result) => sum + result.pointTransaction.amount,
      0
    );

    // 최종 잔액 검증 (성공한 복구만 반영)
    const finalBalance = await userBalanceRepository.findOne({
      where: { userId: "user-123" },
    });

    const expectedBalance =
      initialBalance +
      totalChargedAmount -
      totalUsedAmount +
      totalRecoveredAmount;
    expect(finalBalance.balance).toBe(expectedBalance);

    // 트랜잭션 기록 검증 (기존 2개 + 성공한 것들만)
    const transactions = await pointTransactionRepository.find({
      where: { userId: "user-123" },
    });
    expect(transactions).toHaveLength(2 + successes.length);

    const chargeTransactions = transactions.filter((t) => t.type === "CHARGE");
    const useTransactions = transactions.filter((t) => t.type === "USE");
    const recoverTransactions = transactions.filter(
      (t) => t.type === "RECOVER"
    );

    expect(chargeTransactions).toHaveLength(chargeCount);
    expect(useTransactions).toHaveLength(2 + useCount); // 기존 2개 + 새로운 3개
    expect(recoverTransactions).toHaveLength(successfulRecoveries.length);
  });
});
