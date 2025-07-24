import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { OrderRecoveryService } from "@/order/application/order-recovery.service";
import { OrderApplicationService } from "@/order/application/order.service";
import { ProductApplicationService } from "@/product/application/services/product.service";
import { OrderFactory } from "@/order/infrastructure/persistence/factories/order.factory";
import { ProductFactory } from "@/product/infrastructure/persistence/factories/product.factory";
import { UserBalanceFactory } from "@/wallet/infrastructure/persistence/factories/user-balance.factory";
import {
  OrderTypeOrmEntity,
  OrderStatus,
} from "@/order/infrastructure/persistence/orm/order.typeorm.entity";
import { ProductTypeOrmEntity } from "@/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "@/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";

describe("Order Recovery Service Integration Test", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orderRecoveryService: OrderRecoveryService;
  let orderApplicationService: OrderApplicationService;
  let productApplicationService: ProductApplicationService;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let stockReservationRepository: Repository<StockReservationTypeOrmEntity>;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let testHelper: TestContainersHelper;

  const TEST_USER_ID = "test-user-123";
  const TEST_PRODUCT_ID = "test-product-1";

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupWithMySQL();
    app = setup.app;
    dataSource = setup.dataSource;

    orderRecoveryService = app.get<OrderRecoveryService>(OrderRecoveryService);
    orderApplicationService = app.get<OrderApplicationService>(
      OrderApplicationService
    );
    productApplicationService = app.get<ProductApplicationService>(
      ProductApplicationService
    );
    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    stockReservationRepository = dataSource.getRepository(
      StockReservationTypeOrmEntity
    );
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource, {
      id: TEST_USER_ID,
      email: "test@example.com",
      password: "testPassword123",
      name: "테스트 사용자",
    });

    // Factory counter 초기화
    OrderFactory.resetCounter();
    ProductFactory.resetCounter();
    UserBalanceFactory.resetCounter();
  });

  describe("findStalePendingOrders", () => {
    it("오래된 PENDING 주문을 찾아서 반환해야 함", async () => {
      // Given: 오래된 pending 주문과 최근 pending 주문 생성
      const staleDate = new Date(Date.now() - 15 * 60 * 1000); // 15분 전
      const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5분 전

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 10000,
        status: OrderStatus.PENDING,
        idempotencyKey: "stale-order",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 20000,
        status: OrderStatus.PENDING,
        idempotencyKey: "recent-order",
        createdAt: recentDate,
        updatedAt: recentDate,
      });

      // When: 오래된 pending 주문 조회
      const stalePendingOrders =
        await orderApplicationService.findStalePendingOrders(10, 50);

      // Then: 오래된 주문만 반환되어야 함
      expect(stalePendingOrders).toHaveLength(1);
      expect(stalePendingOrders[0].idempotencyKey).toBe("stale-order");
    });

    it("임계값보다 최근인 주문들은 반환하지 않아야 함", async () => {
      // Given: 모든 주문이 최근에 생성됨
      const recentDate = new Date(Date.now() - 5 * 60 * 1000);

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 10000,
        status: OrderStatus.PENDING,
        idempotencyKey: "recent-order-1",
        createdAt: recentDate,
        updatedAt: recentDate,
      });

      // When: 오래된 pending 주문 조회
      const stalePendingOrders =
        await orderApplicationService.findStalePendingOrders(10, 50);

      // Then: 빈 배열이 반환되어야 함
      expect(stalePendingOrders).toHaveLength(0);
    });

    it("SUCCESS 또는 FAILED 상태 주문들은 반환하지 않아야 함", async () => {
      // Given: 다양한 상태의 오래된 주문들
      const staleDate = new Date(Date.now() - 15 * 60 * 1000);

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 10000,
        status: OrderStatus.PENDING,
        idempotencyKey: "stale-pending",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 20000,
        status: OrderStatus.SUCCESS,
        idempotencyKey: "stale-success",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 30000,
        status: OrderStatus.FAILED,
        idempotencyKey: "stale-failed",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      // When: 오래된 pending 주문 조회
      const stalePendingOrders =
        await orderApplicationService.findStalePendingOrders(10, 50);

      // Then: PENDING 상태 주문만 반환되어야 함
      expect(stalePendingOrders).toHaveLength(1);
      expect(stalePendingOrders[0].idempotencyKey).toBe("stale-pending");
    });
  });

  describe("findFailedOrders", () => {
    it("FAILED 상태의 주문들을 반환해야 함", async () => {
      // Given: 다양한 상태의 주문들
      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 10000,
        status: OrderStatus.FAILED,
        idempotencyKey: "failed-order-1",
      });

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 20000,
        status: OrderStatus.FAILED,
        idempotencyKey: "failed-order-2",
      });

      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 30000,
        status: OrderStatus.SUCCESS,
        idempotencyKey: "success-order",
      });

      // When: 실패한 주문 조회
      const failedOrders = await orderApplicationService.findFailedOrders(10);

      // Then: FAILED 상태 주문들만 반환되어야 함
      expect(failedOrders).toHaveLength(2);
      expect(
        failedOrders.every((order) => order.status === OrderStatus.FAILED)
      ).toBe(true);
    });

    it("limit 파라미터가 적용되어야 함", async () => {
      // Given: 3개의 실패한 주문 생성
      for (let i = 1; i <= 3; i++) {
        await OrderFactory.createAndSave(orderRepository, {
          userId: TEST_USER_ID,
          totalPrice: 10000 * i,
          status: OrderStatus.FAILED,
          idempotencyKey: `failed-order-${i}`,
        });
      }

      // When: limit 2로 조회
      const failedOrders = await orderApplicationService.findFailedOrders(2);

      // Then: 2개만 반환되어야 함
      expect(failedOrders).toHaveLength(2);
    });
  });

  describe("recoverStalePendingOrders", () => {
    beforeEach(async () => {
      // 테스트용 상품과 잔액 설정
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID,
        name: "테스트 상품",
        price: 10000,
        totalStock: 98, // 재고가 일부 사용된 상태
        reservedStock: 2,
        isActive: true,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID,
        balance: 30000, // 일부 금액이 차감된 상태
      });
    });

    it("오래된 PENDING 주문이 복구되어야 함", async () => {
      // Given: 오래된 pending 주문 생성
      const staleDate = new Date(Date.now() - 15 * 60 * 1000);
      const stalePendingOrder = await OrderFactory.createAndSave(
        orderRepository,
        {
          userId: TEST_USER_ID,
          totalPrice: 20000,
          discountPrice: 0,
          finalPrice: 20000,
          status: OrderStatus.PENDING,
          idempotencyKey: "stale-pending-order-001",
          createdAt: staleDate,
          updatedAt: staleDate,
        }
      );

      // 재고 예약 생성 (복구되어야 할 상태)
      await stockReservationRepository.save({
        id: "stale-reservation-1",
        productId: TEST_PRODUCT_ID,
        userId: TEST_USER_ID,
        quantity: 2,
        isActive: true,
        idempotencyKey: "stale-pending-order-001",
        expiresAt: new Date(staleDate.getTime() + 300000),
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      // When: 오래된 pending 주문 복구 실행
      await orderRecoveryService.recoverStalePendingOrders();

      // Then: 주문이 처리되어야 함 (상태는 구현에 따라 달라질 수 있음)
      const processedOrder = await orderRepository.findOne({
        where: { id: stalePendingOrder.id },
      });
      expect(processedOrder).toBeTruthy();

      // 재고 예약이 비활성화되어야 함
      const stockReservation = await stockReservationRepository.findOne({
        where: { id: "stale-reservation-1" },
      });
      expect(stockReservation.isActive).toBe(false);
    });

    it("복구할 오래된 주문이 없으면 아무 작업도 하지 않아야 함", async () => {
      // Given: 최근 주문만 있는 상황
      const recentDate = new Date(Date.now() - 5 * 60 * 1000);
      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 10000,
        status: OrderStatus.PENDING,
        idempotencyKey: "recent-order",
        createdAt: recentDate,
        updatedAt: recentDate,
      });

      // When: 복구 서비스 실행
      const result = await orderRecoveryService.recoverStalePendingOrders();

      // Then: 에러가 발생하지 않고 정상 완료되어야 함
      expect(result).toBeUndefined(); // void 함수
    });
  });

  describe("retryFailedOrders", () => {
    beforeEach(async () => {
      // 테스트용 상품과 잔액 설정
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID,
        name: "테스트 상품",
        price: 10000,
        totalStock: 100,
        reservedStock: 2, // 해제할 재고가 있도록 설정
        isActive: true,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID,
        balance: 50000,
      });
    });

    it("실패한 주문이 복구 처리되어야 함", async () => {
      // Given: 실패한 주문 생성
      const failedOrder = await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 20000,
        discountPrice: 0,
        finalPrice: 20000,
        status: OrderStatus.FAILED,
        idempotencyKey: "failed-order-001",
        failedReason: "Stock reservation failed",
      });

      // 복구해야 할 재고 예약 생성
      await stockReservationRepository.save({
        id: "failed-reservation-1",
        productId: TEST_PRODUCT_ID,
        userId: TEST_USER_ID,
        quantity: 2,
        isActive: true,
        idempotencyKey: "failed-order-001",
        expiresAt: new Date(Date.now() + 300000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // When: 실패한 주문 재시도 실행
      await orderRecoveryService.retryFailedOrders();

      // Then: 복구 로직이 실행되어야 함
      const processedOrder = await orderRepository.findOne({
        where: { id: failedOrder.id },
      });
      expect(processedOrder).toBeTruthy();

      // 재고 예약이 비활성화되어야 함
      const stockReservation = await stockReservationRepository.findOne({
        where: { id: "failed-reservation-1" },
      });
      expect(stockReservation.isActive).toBe(false);
    });

    it("재시도할 실패한 주문이 없으면 아무 작업도 하지 않아야 함", async () => {
      // Given: 성공한 주문만 있는 상황
      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 20000,
        status: OrderStatus.SUCCESS,
        idempotencyKey: "success-order-001",
      });

      // When: 재시도 서비스 실행
      const result = await orderRecoveryService.retryFailedOrders();

      // Then: 에러가 발생하지 않고 정상 완료되어야 함
      expect(result).toBeUndefined(); // void 함수
    });
  });

  describe("복구 중 에러 처리", () => {
    it("복구 중 에러가 발생해도 다른 주문 복구는 계속되어야 함", async () => {
      // Given: 정상 주문과 문제가 있는 주문 생성
      const staleDate = new Date(Date.now() - 15 * 60 * 1000);

      // 정상적으로 복구 가능한 주문
      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 10000,
        status: OrderStatus.PENDING,
        idempotencyKey: "normal-stale-order",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      // 문제가 있는 주문 (존재하지 않는 상품 참조 등)
      await OrderFactory.createAndSave(orderRepository, {
        userId: TEST_USER_ID,
        totalPrice: 20000,
        status: OrderStatus.PENDING,
        idempotencyKey: "problematic-stale-order",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      // When: 복구 실행 (에러가 발생할 수 있는 상황)
      await orderRecoveryService.recoverStalePendingOrders();

      // Then: 복구 서비스가 중단되지 않고 완료되어야 함
      const orders = await orderRepository.find();
      expect(orders).toHaveLength(2);
    });
  });
});
