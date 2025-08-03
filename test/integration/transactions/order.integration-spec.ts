import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { OrderFactory } from "@/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "@/order/infrastructure/persistence/factories/order-item.factory";
import { ProductFactory } from "@/product/infrastructure/persistence/factories/product.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { UserBalanceFactory } from "@/wallet/infrastructure/persistence/factories/user-balance.factory";
import { StockReservationFactory } from "@/product/infrastructure/persistence/factories/stock-reservations.factory";
import {
  OrderStatus,
  OrderTypeOrmEntity,
} from "@/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "@/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { ProductTypeOrmEntity } from "@/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "@/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponStatus,
  UserCouponTypeOrmEntity,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { Order } from "@/order/domain/entities/order.entitiy";
import { CreateOrderUseCase } from "@/order/application/use-cases/tier-1-in-domain/create-order.use-case";
import { ApplyDiscountUseCase } from "@/order/application/use-cases/tier-1-in-domain/apply-discount.use-case";
import { ChangeOrderStatusUseCase } from "@/order/application/use-cases/tier-1-in-domain/change-order-status.use-case";
import { ProcessOrderUseCase } from "@/order/application/use-cases/tier-2/process-order.use-case";
import { RecoverOrderUseCase } from "@/order/application/use-cases/tier-2/recover-order.use-case";
import { UseUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { RecoverUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { UsePointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/use-points.use-case";
import { RecoverPointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";
import { ConfirmStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { ReleaseStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";
import { OrderItemRepository } from "@/order/infrastructure/persistence/order-item.repository";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";
import { ValidateUserCouponService } from "@/coupon/domain/services/validate-user-coupon.service";
import { ValidatePointTransactionService } from "@/wallet/domain/services/validate-point-transaction.service";
import { StockReservationStatus } from "@/product/domain/entities/stock-reservation.entity";

describe("Order Domain Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let orderItemRepository: Repository<OrderItemTypeOrmEntity>;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let stockReservationRepository: Repository<StockReservationTypeOrmEntity>;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>;
  let createOrderUseCase: CreateOrderUseCase;
  let processOrderUseCase: ProcessOrderUseCase;
  let recoverOrderUseCase: RecoverOrderUseCase;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupDatabaseOnly();
    dataSource = setup.dataSource;

    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
    orderItemRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    stockReservationRepository = dataSource.getRepository(
      StockReservationTypeOrmEntity
    );
    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
    pointTransactionRepository = dataSource.getRepository(
      PointTransactionTypeOrmEntity
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(OrderTypeOrmEntity),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(OrderItemTypeOrmEntity),
          useValue: orderItemRepository,
        },
        {
          provide: getRepositoryToken(ProductTypeOrmEntity),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(StockReservationTypeOrmEntity),
          useValue: stockReservationRepository,
        },
        {
          provide: getRepositoryToken(CouponTypeOrmEntity),
          useValue: couponRepository,
        },
        {
          provide: getRepositoryToken(UserCouponTypeOrmEntity),
          useValue: userCouponRepository,
        },
        {
          provide: getRepositoryToken(UserBalanceTypeOrmEntity),
          useValue: userBalanceRepository,
        },
        {
          provide: getRepositoryToken(PointTransactionTypeOrmEntity),
          useValue: pointTransactionRepository,
        },
        OrderRepository,
        OrderItemRepository,
        ProductRepository,
        StockReservationRepository,
        CouponRepository,
        UserCouponRepository,
        UserBalanceRepository,
        PointTransactionRepository,
        ValidateStockService,
        ValidateUserCouponService,
        ValidatePointTransactionService,
        CreateOrderUseCase,
        ApplyDiscountUseCase,
        ChangeOrderStatusUseCase,
        UseUserCouponUseCase,
        RecoverUserCouponUseCase,
        UsePointsUseCase,
        RecoverPointsUseCase,
        ConfirmStockUseCase,
        ReleaseStockUseCase,
        ProcessOrderUseCase,
        RecoverOrderUseCase,
      ],
    }).compile();

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
    StockReservationFactory.resetCounter();
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

      // 순서를 보장하기 위해 productId로 정렬하여 검증
      const sortedOrderItems = savedOrder.orderItems.sort((a, b) =>
        a.productId.localeCompare(b.productId)
      );
      const sortedExpectedItems = [
        { productId: product1.id, quantity: 2 },
        { productId: product2.id, quantity: 1 },
      ].sort((a, b) => a.productId.localeCompare(b.productId));

      expect(sortedOrderItems[0].quantity).toBe(
        sortedExpectedItems[0].quantity
      );
      expect(sortedOrderItems[1].quantity).toBe(
        sortedExpectedItems[1].quantity
      );
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
        reservedStock: 1, // 재고 예약 준비
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
        minimumOrderPrice: 5000, // 주문 금액(10000)보다 낮게 설정
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

      // 5. 재고 예약 생성
      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          orderId: order.id,
          quantity: 1,
          status: StockReservationStatus.RESERVED,
        }
      );

      // When: 주문을 처리 (쿠폰 + 포인트 사용)
      const command = {
        userId: "user-123",
        userCouponId: userCoupon.id,
        order: new Order({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedUserCouponId: order.appliedUserCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        discountPrice: 1000, // 쿠폰 할인
        discountedPrice: 9000, // 10000 - 1000
        stockReservationIds: [stockReservation.id],
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

      // 실패 테스트용 제품 생성
      const failTestProduct = await ProductFactory.createAndSave(
        productRepository,
        {
          price: 10000,
          totalStock: 5,
          reservedStock: 0, // 예약 없음
        }
      );

      // 재고 예약 생성
      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: failTestProduct.id,
          userId: "user-123",
          orderId: order.id,
          quantity: 1,
          status: StockReservationStatus.RESERVED,
        }
      );

      // When: 주문 처리 시도 (잔액 부족으로 실패 예상)
      const command = {
        userId: "user-123",
        userCouponId: null,
        order: new Order({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedUserCouponId: order.appliedUserCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        discountPrice: 0,
        discountedPrice: 10000,
        stockReservationIds: [stockReservation.id],
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

  describe.skip("RecoverOrderUseCase (@Transactional) - Rollback Integration", () => {
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
        minimumOrderPrice: 5000, // 주문 금액보다 낮게 설정
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

      // 복구용 제품 생성
      const recoverTestProduct = await ProductFactory.createAndSave(
        productRepository,
        {
          price: 10000,
          totalStock: 5,
          reservedStock: 0, // 이미 확정됨
        }
      );

      // 재고 예약 생성 (복구할 예약)
      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: recoverTestProduct.id,
          userId: "user-123",
          orderId: order.id,
          quantity: 1,
          status: StockReservationStatus.CONFIRMED, // 이미 확정된 상태
        }
      );

      // When: 주문을 복구
      const command = {
        order: new Order({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedUserCouponId: order.appliedUserCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        userCouponId: userCoupon.id,
        stockReservationIds: [stockReservation.id],
        orderId: order.id,
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

      // 실패한 주문용 제품 생성
      const failedOrderProduct = await ProductFactory.createAndSave(
        productRepository,
        {
          price: 10000,
          totalStock: 5,
          reservedStock: 0,
        }
      );

      // 재고 예약 생성 (실패한 주문의 예약)
      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: failedOrderProduct.id,
          userId: "user-123",
          orderId: order.id,
          quantity: 1,
          status: StockReservationStatus.RELEASED, // 이미 처리된 상태
        }
      );

      // When: 실패한 주문을 다시 복구 시도
      const command = {
        order: new Order({
          id: order.id,
          userId: order.userId,
          totalPrice: order.totalPrice,
          discountPrice: order.discountPrice,
          finalPrice: order.finalPrice,
          status: order.status,
          failedReason: order.failedReason,
          idempotencyKey: order.idempotencyKey,
          appliedUserCouponId: order.appliedUserCouponId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          OrderItems: [],
        }),
        userCouponId: null,
        stockReservationIds: [stockReservation.id],
        orderId: order.id,
      };

      // Then: 중복 복구 처리가 적절히 이루어져야 함
      // (실제 구현에 따라 예외 발생 또는 무시)
      const result = await recoverOrderUseCase.execute(command);
      expect(result.order.status).toBe(OrderStatus.FAILED);
    });
  });

  describe.skip("Order State Transition Integration", () => {
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

      // 제품 재고 예약 (실제 재고 예약 프로세스 시뮬레이션)
      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      // 재고 예약을 위해 제품의 reservedStock 업데이트
      updatedProduct.reservedStock = 1;
      await productRepository.save(updatedProduct);

      // 재고 예약 생성
      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          orderId: createResult.order.id,
          quantity: 1,
          status: StockReservationStatus.RESERVED,
        }
      );

      // Step 2: 주문 처리
      const processCommand = {
        userId: "user-123",
        userCouponId: null,
        order: createResult.order,
        discountPrice: 0,
        discountedPrice: 5000,
        stockReservationIds: [stockReservation.id],
        idempotencyKey: "process-lifecycle-order",
      };

      const processResult = await processOrderUseCase.execute(processCommand);
      expect(processResult.order.status).toBe(OrderStatus.SUCCESS);

      // Step 3: 문제 발생으로 주문 복구
      const recoverCommand = {
        order: processResult.order,
        userCouponId: null,
        stockReservationIds: [stockReservation.id],
        orderId: createResult.order.id,
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
