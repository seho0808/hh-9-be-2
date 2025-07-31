import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../testcontainers-helper";
import { OrderFactory } from "../../src/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "../../src/order/infrastructure/persistence/factories/order-item.factory";
import { ProductFactory } from "../../src/product/infrastructure/persistence/factories/product.factory";
import { CouponFactory } from "../../src/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "../../src/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { UserBalanceFactory } from "../../src/wallet/infrastructure/persistence/factories/user-balance.factory";
import {
  OrderTypeOrmEntity,
  OrderStatus,
} from "../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { Order } from "../../src/order/domain/entities/order.entitiy";
import { OrderItemTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { CouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponTypeOrmEntity,
  UserCouponStatus,
} from "../../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { CreateOrderUseCase } from "../../src/order/application/use-cases/tier-1-in-domain/create-order.use-case";
import { ProcessOrderUseCase } from "../../src/order/application/use-cases/tier-2/process-order.use-case";
import { RecoverOrderUseCase } from "../../src/order/application/use-cases/tier-2/recover-order.use-case";
import { OrderModule } from "../../src/order/order.module";
import { ProductModule } from "../../src/product/product.module";
import { CouponModule } from "../../src/coupon/coupon.module";
import { WalletModule } from "../../src/wallet/wallet.module";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

describe("Order Domain Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let orderItemRepository: Repository<OrderItemTypeOrmEntity>;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let createOrderUseCase: CreateOrderUseCase;
  let processOrderUseCase: ProcessOrderUseCase;
  let recoverOrderUseCase: RecoverOrderUseCase;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupWithMySQL();
    dataSource = setup.dataSource;

    // Create module with all necessary modules for order domain integration test
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrderModule, ProductModule, CouponModule, WalletModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
    orderItemRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);

    createOrderUseCase =
      moduleFixture.get<CreateOrderUseCase>(CreateOrderUseCase);
    processOrderUseCase =
      moduleFixture.get<ProcessOrderUseCase>(ProcessOrderUseCase);
    recoverOrderUseCase =
      moduleFixture.get<RecoverOrderUseCase>(RecoverOrderUseCase);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource);

    // Reset all factory counters
    OrderFactory.resetCounter();
    OrderItemFactory.resetCounter();
    ProductFactory.resetCounter();
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();
    UserBalanceFactory.resetCounter();
  });

  describe("CreateOrderUseCase (@Transactional)", () => {
    it("주문 생성이 성공적으로 처리되어야 함", async () => {
      // Given: 주문할 상품들
      const product1 = await ProductFactory.createAndSave(productRepository, {
        price: 1000,
        totalStock: 10,
      });
      const product2 = await ProductFactory.createAndSave(productRepository, {
        price: 2000,
        totalStock: 5,
      });

      // When: 주문을 생성
      const command = {
        userId: "user-123",
        idempotencyKey: "order-create-key-1",
        items: [
          {
            productId: product1.id,
            unitPrice: 1000,
            quantity: 2,
          },
          {
            productId: product2.id,
            unitPrice: 2000,
            quantity: 1,
          },
        ],
      };

      const result = await createOrderUseCase.execute(command);

      // Then: 주문과 주문 아이템이 생성되어야 함
      expect(result.order.userId).toBe("user-123");
      expect(result.order.status).toBe(OrderStatus.PENDING);
      expect(result.order.totalPrice).toBe(4000); // 1000*2 + 2000*1
      expect(result.order.discountPrice).toBe(0);
      expect(result.order.finalPrice).toBe(4000);

      // DB 검증
      const savedOrder = await orderRepository.findOne({
        where: { id: result.order.id },
        relations: ["orderItems"],
      });
      expect(savedOrder).toBeDefined();
      expect(savedOrder.orderItems).toHaveLength(2);
      expect(savedOrder.orderItems[0].quantity).toBe(2);
      expect(savedOrder.orderItems[1].quantity).toBe(1);
    });

    it("동일한 idempotencyKey로 중복 요청 시 중복 생성이 방지되어야 함", async () => {
      // Given: 상품과 첫 번째 주문
      const product = await ProductFactory.createAndSave(productRepository, {
        price: 1000,
        totalStock: 10,
      });

      const command = {
        userId: "user-123",
        idempotencyKey: "duplicate-order-key",
        items: [
          {
            productId: product.id,
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      };

      // When: 동일한 idempotencyKey로 두 번 요청
      const result1 = await createOrderUseCase.execute(command);

      // Then: 두 번째 요청이 중복 생성을 방지하거나 동일한 결과를 반환해야 함
      // (실제 구현에 따라 예외 발생 또는 동일 결과 반환)
      await expect(createOrderUseCase.execute(command)).rejects.toThrow();

      // DB 검증 - 하나의 주문만 생성되어야 함
      const orders = await orderRepository.find({
        where: { userId: "user-123" },
      });
      expect(orders).toHaveLength(1);
    });
  });

  describe("ProcessOrderUseCase (@Transactional) - Complex Integration", () => {
    it("쿠폰과 포인트를 모두 사용한 주문 처리가 성공적으로 이루어져야 함", async () => {
      // Given: 복잡한 주문 처리를 위한 설정
      // 1. 상품 준비
      const product = await ProductFactory.createAndSave(productRepository, {
        price: 10000,
        totalStock: 10,
        reservedStock: 2,
      });

      // 2. 주문 생성
      const order = await OrderFactory.createAndSave(orderRepository, {
        userId: "user-123",
        totalPrice: 10000,
        discountPrice: 0,
        finalPrice: 10000,
        status: OrderStatus.PENDING,
      });

      // 3. 쿠폰 준비
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        discountValue: 1000,
        totalCount: 100,
        usedCount: 0,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.ISSUED,
        }
      );

      // 4. 사용자 잔액 준비
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 20000,
        }
      );

      // When: 주문을 처리 (쿠폰 + 포인트 사용)
      const command = {
        userId: "user-123",
        couponId: coupon.id,
        order: Order.fromPersistence({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedCouponId: order.appliedCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        discountPrice: 1000, // 쿠폰 할인
        discountedPrice: 9000, // 10000 - 1000
        stockReservationIds: ["reservation-1"],
        idempotencyKey: "process-order-key-1",
      };

      const result = await processOrderUseCase.execute(command);

      // Then: 주문이 완료 상태로 변경되어야 함
      expect(result.order.status).toBe(OrderStatus.SUCCESS);

      // DB 검증
      const savedOrder = await orderRepository.findOne({
        where: { id: order.id },
      });
      expect(savedOrder.status).toBe(OrderStatus.SUCCESS);
      expect(savedOrder.discountPrice).toBe(1000);

      // 쿠폰 사용 확인
      const updatedUserCoupon = await userCouponRepository.findOne({
        where: { id: userCoupon.id },
      });
      expect(updatedUserCoupon.status).toBe(UserCouponStatus.USED);

      // 포인트 차감 확인
      const updatedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(updatedUserBalance.balance).toBe(11000); // 20000 - 9000
    });

    it("처리 중 오류 발생 시 전체 트랜잭션이 롤백되어야 함", async () => {
      // Given: 처리할 수 없는 상황을 만든 주문
      const order = await OrderFactory.createAndSave(orderRepository, {
        userId: "user-123",
        totalPrice: 10000,
        discountPrice: 0,
        finalPrice: 10000,
        status: OrderStatus.PENDING,
      });

      // 잔액 부족한 사용자
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 1000, // 주문 금액보다 적음
        }
      );

      // When: 주문 처리 시도 (잔액 부족으로 실패 예상)
      const command = {
        userId: "user-123",
        couponId: null,
        order: Order.fromPersistence({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedCouponId: order.appliedCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        discountPrice: 0,
        discountedPrice: 10000,
        stockReservationIds: ["reservation-1"],
        idempotencyKey: "process-order-fail-key",
      };

      // Then: 전체 트랜잭션이 실패해야 함
      await expect(processOrderUseCase.execute(command)).rejects.toThrow();

      // DB 롤백 검증
      const savedOrder = await orderRepository.findOne({
        where: { id: order.id },
      });
      expect(savedOrder.status).toBe(OrderStatus.PENDING); // 변경되지 않음

      const savedUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(savedUserBalance.balance).toBe(1000); // 변경되지 않음
    });
  });

  describe("RecoverOrderUseCase (@Transactional) - Rollback Integration", () => {
    it("주문 복구가 성공적으로 처리되어야 함", async () => {
      // Given: 처리된 주문과 관련 데이터들
      const order = await OrderFactory.createAndSave(orderRepository, {
        userId: "user-123",
        totalPrice: 10000,
        discountPrice: 1000,
        finalPrice: 9000,
        status: OrderStatus.SUCCESS,
      });

      // 사용된 쿠폰
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        discountValue: 1000,
        totalCount: 100,
        usedCount: 0,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          userId: "user-123",
          couponId: coupon.id,
          status: UserCouponStatus.USED, // 이미 사용됨
        }
      );

      // 차감된 잔액
      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 11000, // 20000에서 9000 차감됨
        }
      );

      // When: 주문을 복구
      const command = {
        order: Order.fromPersistence({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedCouponId: order.appliedCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        couponId: coupon.id,
        stockReservationIds: ["reservation-1"],
        idempotencyKey: "recover-order-key-1",
      };

      const result = await recoverOrderUseCase.execute(command);

      // Then: 주문이 실패 상태로 변경되어야 함
      expect(result.order.status).toBe(OrderStatus.FAILED);

      // DB 검증
      const savedOrder = await orderRepository.findOne({
        where: { id: order.id },
      });
      expect(savedOrder.status).toBe(OrderStatus.FAILED);

      // 쿠폰 복구 확인
      const recoveredUserCoupon = await userCouponRepository.findOne({
        where: { id: userCoupon.id },
      });
      expect(recoveredUserCoupon.status).toBe("ISSUED");

      // 포인트 복구 확인
      const recoveredUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(recoveredUserBalance.balance).toBe(20000); // 9000 복구됨
    });

    it("이미 실패한 주문에 대한 중복 복구 시도가 적절히 처리되어야 함", async () => {
      // Given: 이미 실패 상태인 주문
      const order = await OrderFactory.createAndSave(orderRepository, {
        userId: "user-123",
        totalPrice: 10000,
        discountPrice: 0,
        finalPrice: 10000,
        status: OrderStatus.FAILED, // 이미 실패 상태
      });

      // When: 실패한 주문을 다시 복구 시도
      const command = {
        order: Order.fromPersistence({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedCouponId: order.appliedCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        couponId: null,
        stockReservationIds: ["reservation-1"],
        idempotencyKey: "recover-failed-order-key",
      };

      // Then: 중복 복구 처리가 적절히 이루어져야 함
      // (실제 구현에 따라 예외 발생 또는 무시)
      const result = await recoverOrderUseCase.execute(command);
      expect(result.order.status).toBe(OrderStatus.FAILED);
    });
  });

  describe("Order State Transition Integration", () => {
    it("주문의 전체 생명주기가 올바르게 관리되어야 함", async () => {
      // Given: 전체 주문 프로세스를 위한 설정
      const product = await ProductFactory.createAndSave(productRepository, {
        price: 5000,
        totalStock: 10,
      });

      const userBalance = await UserBalanceFactory.createAndSave(
        userBalanceRepository,
        {
          userId: "user-123",
          balance: 10000,
        }
      );

      // Step 1: 주문 생성
      const createCommand = {
        userId: "user-123",
        idempotencyKey: "lifecycle-order-key",
        items: [
          {
            productId: product.id,
            unitPrice: 5000,
            quantity: 1,
          },
        ],
      };

      const createResult = await createOrderUseCase.execute(createCommand);
      expect(createResult.order.status).toBe(OrderStatus.PENDING);

      // Step 2: 주문 처리
      const processCommand = {
        userId: "user-123",
        couponId: null,
        order: createResult.order,
        discountPrice: 0,
        discountedPrice: 5000,
        stockReservationIds: ["reservation-1"],
        idempotencyKey: "process-lifecycle-order",
      };

      const processResult = await processOrderUseCase.execute(processCommand);
      expect(processResult.order.status).toBe(OrderStatus.SUCCESS);

      // Step 3: 문제 발생으로 주문 복구
      const recoverCommand = {
        order: processResult.order,
        couponId: null,
        stockReservationIds: ["reservation-1"],
        idempotencyKey: "recover-lifecycle-order",
      };

      const recoverResult = await recoverOrderUseCase.execute(recoverCommand);
      expect(recoverResult.order.status).toBe(OrderStatus.FAILED);

      // Final DB 검증
      const finalOrder = await orderRepository.findOne({
        where: { id: createResult.order.id },
      });
      expect(finalOrder.status).toBe(OrderStatus.FAILED);

      const finalUserBalance = await userBalanceRepository.findOne({
        where: { userId: "user-123" },
      });
      expect(finalUserBalance.balance).toBe(10000); // 원래 상태로 복구
    });
  });
});
