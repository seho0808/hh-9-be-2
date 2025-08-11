import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponStatus,
  UserCouponTypeOrmEntity,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { UseUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { CancelUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/cancel-user-coupon.use-case";
import { RecoverUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { OrderFactory } from "@/order/infrastructure/persistence/factories/order.factory";
import {
  OrderStatus,
  OrderTypeOrmEntity,
} from "@/order/infrastructure/persistence/orm/order.typeorm.entity";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";

describe("Coupon Concurrency Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let issueUserCouponUseCase: IssueUserCouponUseCase;
  let useUserCouponUseCase: UseUserCouponUseCase;
  let cancelUserCouponUseCase: CancelUserCouponUseCase;
  let recoverUserCouponUseCase: RecoverUserCouponUseCase;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseOnlyEnvironment();
    dataSource = environment.dataSource;

    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(CouponTypeOrmEntity),
          useValue: couponRepository,
        },
        {
          provide: getRepositoryToken(UserCouponTypeOrmEntity),
          useValue: userCouponRepository,
        },
        CouponRepository,
        UserCouponRepository,
        ValidateUserCouponService,
        IssueUserCouponUseCase,
        UseUserCouponUseCase,
        CancelUserCouponUseCase,
        RecoverUserCouponUseCase,
      ],
    }).compile();

    issueUserCouponUseCase = moduleFixture.get<IssueUserCouponUseCase>(
      IssueUserCouponUseCase
    );
    useUserCouponUseCase =
      moduleFixture.get<UseUserCouponUseCase>(UseUserCouponUseCase);
    cancelUserCouponUseCase = moduleFixture.get<CancelUserCouponUseCase>(
      CancelUserCouponUseCase
    );
    recoverUserCouponUseCase = moduleFixture.get<RecoverUserCouponUseCase>(
      RecoverUserCouponUseCase
    );
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.dataHelper.createTestUser();

    // Create additional test users for concurrent requests
    const hashedPassword = "hashed_password";
    const users = Array.from({ length: 20 }, (_, i) => ({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      password: hashedPassword,
      name: `테스트 사용자 ${i}`,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await dataSource
      .createQueryBuilder()
      .insert()
      .into("users")
      .values(users)
      .execute();

    // Reset factory counters
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();
  });

  it("다인 발급 - 제한된 수량의 쿠폰을 동시에 발급할 때 수량 제한이 정확히 지켜져야 함", async () => {
    // Given: 제한된 수량의 쿠폰 (총 5개)
    const totalCount = 5;
    const coupon = await CouponFactory.createAndSave(couponRepository, {
      couponCode: "LIMITED5",
      discountValue: 1000,
      discountType: "FIXED",
      totalCount: totalCount,
      issuedCount: 0,
      endDate: new Date(Date.now() + 86400000), // 24시간 후
    });

    const concurrentRequests = 10; // 제한 수량보다 많은 요청

    // When: 동시에 여러 사용자가 쿠폰 발급 시도
    const issuePromises = Array.from({ length: concurrentRequests }, (_, i) =>
      issueUserCouponUseCase
        .execute({
          couponId: coupon.id,
          userId: `user-${i}`,
          couponCode: "LIMITED5",
          idempotencyKey: `limited-issue-${i}`,
        })
        .catch((error) => ({ error }))
    );

    const results = await Promise.all(issuePromises);

    // Then: 정확히 5개만 성공하고 나머지는 실패해야 함
    const successes = results.filter((result) => !("error" in result));
    const failures = results.filter((result) => "error" in result);

    expect(successes.length).toBe(totalCount);
    expect(failures.length).toBe(concurrentRequests - totalCount);

    // 쿠폰의 발급 수량 검증
    const updatedCoupon = await couponRepository.findOne({
      where: { id: coupon.id },
    });
    expect(updatedCoupon.issuedCount).toBe(totalCount);

    // 실제 발급된 사용자 쿠폰 수량 검증
    const issuedUserCoupons = await userCouponRepository.find({
      where: { couponId: coupon.id },
    });
    expect(issuedUserCoupons).toHaveLength(totalCount);
  });

  it("일인 발급 - 한 명의 사용자가 동일한 쿠폰을 동시에 여러 번 발급 시도할 때 하나만 성공해야 함", async () => {
    // Given: 충분한 수량의 쿠폰
    const coupon = await CouponFactory.createAndSave(couponRepository, {
      couponCode: "SAMEUSER10",
      discountValue: 1000,
      discountType: "FIXED",
      totalCount: 100,
      issuedCount: 0,
      endDate: new Date(Date.now() + 86400000),
    });

    const concurrentRequests = 5;
    const targetUserId = "user-123";

    // When: 동일한 사용자가 동시에 같은 쿠폰 발급 시도 (다른 idempotencyKey)
    const issuePromises = Array.from({ length: concurrentRequests }, (_, i) =>
      issueUserCouponUseCase
        .execute({
          couponId: coupon.id,
          userId: targetUserId,
          couponCode: "SAMEUSER10",
          idempotencyKey: `same-user-issue-${i}`, // 각각 다른 idempotencyKey
        })
        .catch((error) => ({ error }))
    );

    const results = await Promise.all(issuePromises);

    // Then: 하나만 성공하고 나머지는 실패해야 함 (중복 발급 방지)
    const successes = results.filter((result) => !("error" in result));
    const failures = results.filter((result) => "error" in result);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(concurrentRequests - 1);

    // 해당 사용자에게 하나의 쿠폰만 발급되었는지 확인
    const userCoupons = await userCouponRepository.find({
      where: { userId: targetUserId, couponId: coupon.id },
    });
    expect(userCoupons).toHaveLength(1);
  });

  it("일인 사용 - 한 명의 사용자가 동일한 쿠폰을 여러 번 사용할 때 하나만 성공해야 함", async () => {
    // Given: 쿠폰 생성 및 사용자에게 발급
    const coupon = await CouponFactory.createAndSave(couponRepository, {
      couponCode: "MULTIUSE10",
      discountValue: 1000,
      discountType: "FIXED",
      totalCount: 100,
      issuedCount: 0,
      minimumOrderPrice: 5000, // 최소 주문 금액을 낮게 설정
      endDate: new Date(Date.now() + 86400000),
    });

    const targetUserId = "user-0";

    // 테스트용 주문 생성
    const orderId = "test-order-123";
    await OrderFactory.createAndSave(orderRepository, {
      id: orderId,
      userId: targetUserId,
      totalPrice: 10000,
      discountPrice: 0,
      finalPrice: 10000,
      status: OrderStatus.PENDING,
      failedReason: null,
      idempotencyKey: "test-order-123-key",
      appliedUserCouponId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 사용자에게 쿠폰 발급
    await issueUserCouponUseCase.execute({
      couponId: coupon.id,
      userId: targetUserId,
      couponCode: "MULTIUSE10",
      idempotencyKey: "issue-multi-use",
    });

    const issuedUserCoupon = await userCouponRepository.findOne({
      where: { userId: targetUserId, couponId: coupon.id },
    });

    const concurrentRequests = 5;

    // When: 동일한 사용자가 동시에 같은 쿠폰을 여러 번 사용 시도
    const usePromises = Array.from({ length: concurrentRequests }, (_, i) =>
      useUserCouponUseCase
        .execute({
          userCouponId: issuedUserCoupon.id,
          orderId: orderId,
          orderPrice: 10000,
        })
        .catch((error) => ({ error }))
    );

    const results = await Promise.all(usePromises);

    // Then: 하나만 성공하고 나머지는 실패해야 함
    const successes = results.filter((result) => !("error" in result));
    const failures = results.filter((result) => "error" in result);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(concurrentRequests - 1);

    // 쿠폰 상태가 USED로 변경되었는지 확인
    const updatedUserCoupon = await userCouponRepository.findOne({
      where: { id: issuedUserCoupon.id },
    });
    expect(updatedUserCoupon.status).toBe(UserCouponStatus.USED);
    expect(updatedUserCoupon.orderId).toBe(orderId);
  });

  it("다인 발급 + 다인 사용 + 다인 취소 + 다인 복구 - 모든 usecase가 동시에 호출되어 정상적으로 처리되어야함", async () => {
    // Given: 충분한 수량의 쿠폰 생성
    const coupon = await CouponFactory.createAndSave(couponRepository, {
      couponCode: "COMPLEX_SCENARIO",
      discountValue: 2000,
      discountType: "FIXED",
      totalCount: 50,
      issuedCount: 0,
      minimumOrderPrice: 5000,
      endDate: new Date(Date.now() + 86400000),
    });

    const userCount = 15;

    // 테스트용 사용자들 먼저 생성
    const userRepository = dataSource.getRepository(UserTypeOrmEntity);
    const userValues = Array.from({ length: userCount + 10 }, (_, i) => ({
      id: `user-${i}`,
      email: `user${i}@test.com`,
      password: "hashedpassword",
      name: `Test User ${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await userRepository.save(userValues);

    // 테스트용 주문들 미리 생성
    const orderValues = Array.from({ length: userCount + 10 }, (_, i) => ({
      id: `complex-order-${i}`,
      userId: `user-${i}`,
      totalPrice: 15000,
      discountPrice: 0,
      finalPrice: 15000,
      status: OrderStatus.PENDING,
      failedReason: null,
      idempotencyKey: `complex-order-${i}-key`,
      appliedUserCouponId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await OrderFactory.createManyWithOptionsAndSave(
      orderRepository,
      orderValues
    );

    // 일부 사용자 쿠폰들을 미리 생성하여 다양한 상태로 만들기
    const prepUserCoupons = [];
    for (let i = 0; i < 8; i++) {
      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          couponId: coupon.id,
          userId: `user-${i}`,
          status:
            i < 3
              ? UserCouponStatus.ISSUED
              : i < 6
                ? UserCouponStatus.USED
                : UserCouponStatus.CANCELLED,
          orderId: i >= 3 ? `complex-order-${i}` : null,
          usedAt: i >= 3 && i < 6 ? new Date() : null,
          cancelledAt: i >= 6 ? new Date() : null,
        }
      );
      prepUserCoupons.push(userCoupon);
    }

    // 쿠폰 발급 수 업데이트
    await couponRepository.update(coupon.id, { issuedCount: 8 });

    // When: 모든 작업들을 동시에 실행
    const allOperations = [];

    // 1. 새로운 사용자들의 발급 시도 (8명)
    for (let i = 8; i < 16; i++) {
      allOperations.push(
        issueUserCouponUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "COMPLEX_SCENARIO",
            idempotencyKey: `concurrent-issue-${i}`,
          })
          .catch((error) => ({
            error,
            operation: "issue",
            userId: `user-${i}`,
          }))
      );
    }

    // 2. 발급된 쿠폰들의 사용 시도 (3개)
    const issuedCoupons = prepUserCoupons.filter(
      (uc) => uc.status === UserCouponStatus.ISSUED
    );
    issuedCoupons.forEach((userCoupon) => {
      allOperations.push(
        useUserCouponUseCase
          .execute({
            userCouponId: userCoupon.id,
            orderId: `concurrent-order-${userCoupon.userId.split("-")[1]}`,
            orderPrice: 15000,
          })
          .catch((error) => ({
            error,
            operation: "use",
            userCouponId: userCoupon.id,
          }))
      );
    });

    // 3. 사용된 쿠폰들의 취소 시도 (3개)
    const usedCoupons = prepUserCoupons.filter(
      (uc) => uc.status === UserCouponStatus.USED
    );
    usedCoupons.forEach((userCoupon) => {
      allOperations.push(
        cancelUserCouponUseCase
          .execute({
            userCouponId: userCoupon.id,
          })
          .catch((error) => ({
            error,
            operation: "cancel",
            userCouponId: userCoupon.id,
          }))
      );
    });

    // 4. 취소된 쿠폰들의 복구 시도 (2개)
    const cancelledCoupons = prepUserCoupons.filter(
      (uc) => uc.status === UserCouponStatus.CANCELLED
    );
    cancelledCoupons.forEach((userCoupon) => {
      allOperations.push(
        recoverUserCouponUseCase
          .execute({
            userCouponId: userCoupon.id,
            orderId: userCoupon.orderId,
          })
          .catch((error) => ({
            error,
            operation: "recover",
            userCouponId: userCoupon.id,
          }))
      );
    });

    // 5. 추가 복합 작업들
    for (let i = 16; i < 20; i++) {
      // 발급 시도
      allOperations.push(
        issueUserCouponUseCase
          .execute({
            couponId: coupon.id,
            userId: `user-${i}`,
            couponCode: "COMPLEX_SCENARIO",
            idempotencyKey: `extra-issue-${i}`,
          })
          .catch((error) => ({
            error,
            operation: "extra-issue",
            userId: `user-${i}`,
          }))
      );
    }

    console.log(`총 ${allOperations.length}개의 동시 작업 실행 시작`);

    // 모든 작업을 동시에 실행
    const allResults = await Promise.all(allOperations);

    // 결과 분석
    const successfulOperations = allResults.filter(
      (result) => !("error" in result)
    );
    const failedOperations = allResults.filter((result) => "error" in result);

    console.log(`성공한 작업: ${successfulOperations.length}개`);
    console.log(`실패한 작업: ${failedOperations.length}개`);

    // 각 작업 유형별 결과 분석
    const operationResults = {
      issue: allResults.filter(
        (r) => r.operation?.includes("issue") || (!r.error && !r.operation)
      ),
      use: allResults.filter((r) => r.operation === "use"),
      cancel: allResults.filter((r) => r.operation === "cancel"),
      recover: allResults.filter((r) => r.operation === "recover"),
    };

    Object.entries(operationResults).forEach(([operation, results]) => {
      const successful = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;
      console.log(`${operation}: 성공 ${successful}개, 실패 ${failed}개`);
    });

    // 최종 데이터 일관성 검증
    const finalCoupon = await couponRepository.findOne({
      where: { id: coupon.id },
    });

    const finalUserCoupons = await userCouponRepository.find({
      where: { couponId: coupon.id },
    });

    // 발급된 쿠폰 수와 실제 사용자 쿠폰 수가 일치해야 함
    expect(finalCoupon.issuedCount).toBe(finalUserCoupons.length);

    // 모든 상태별 쿠폰 수의 합이 전체 발급 수와 일치해야 함
    const issuedCount = finalUserCoupons.filter(
      (uc) => uc.status === UserCouponStatus.ISSUED
    ).length;
    const usedCount = finalUserCoupons.filter(
      (uc) => uc.status === UserCouponStatus.USED
    ).length;
    const cancelledCount = finalUserCoupons.filter(
      (uc) => uc.status === UserCouponStatus.CANCELLED
    ).length;

    expect(issuedCount + usedCount + cancelledCount).toBe(
      finalUserCoupons.length
    );

    // 쿠폰 수량 제한이 지켜졌는지 확인
    expect(finalCoupon.issuedCount).toBeLessThanOrEqual(finalCoupon.totalCount);

    console.log(
      `최종 결과: 발급 ${finalCoupon.issuedCount}개, ISSUED ${issuedCount}개, USED ${usedCount}개, CANCELLED ${cancelledCount}개`
    );
  });
});
