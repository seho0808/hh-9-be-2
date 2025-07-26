import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { OrderApplicationService } from "@/order/application/order.service";
import { ProductApplicationService } from "@/product/application/services/product.service";
import { WalletApplicationService } from "@/wallet/application/wallet.service";
import { CouponApplicationService } from "@/coupon/application/services/coupon.service";
import { OrderFactory } from "@/order/infrastructure/persistence/factories/order.factory";
import { ProductFactory } from "@/product/infrastructure/persistence/factories/product.factory";
import { UserBalanceFactory } from "@/wallet/infrastructure/persistence/factories/user-balance.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import {
  OrderTypeOrmEntity,
  OrderStatus,
} from "@/order/infrastructure/persistence/orm/order.typeorm.entity";
import { ProductTypeOrmEntity } from "@/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "@/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponTypeOrmEntity,
  UserCouponStatus,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import {
  InsufficientStockError,
  ProductNotFoundError,
} from "@/product/domain/exceptions/product.exceptions";
import { InsufficientPointBalanceError } from "@/order/application/order.exceptions";

describe("Order Service Data Consistency Integration Test", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orderService: OrderApplicationService;
  let productService: ProductApplicationService;
  let walletService: WalletApplicationService;
  let couponService: CouponApplicationService;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let stockReservationRepository: Repository<StockReservationTypeOrmEntity>;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>;
  let testHelper: TestContainersHelper;

  const TEST_USER_ID_1 = "test-user-1";
  const TEST_USER_ID_2 = "test-user-2";
  const TEST_PRODUCT_ID_1 = "test-product-1";
  const TEST_PRODUCT_ID_2 = "test-product-2";
  const TEST_COUPON_ID = "test-coupon-1";

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupWithMySQL();
    app = setup.app;
    dataSource = setup.dataSource;

    orderService = app.get<OrderApplicationService>(OrderApplicationService);
    productService = app.get<ProductApplicationService>(
      ProductApplicationService
    );
    walletService = app.get<WalletApplicationService>(WalletApplicationService);
    couponService = app.get<CouponApplicationService>(CouponApplicationService);
    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    stockReservationRepository = dataSource.getRepository(
      StockReservationTypeOrmEntity
    );
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    pointTransactionRepository = dataSource.getRepository(
      PointTransactionTypeOrmEntity
    );
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);

    // 테스트 사용자들 생성
    await Promise.all([
      testHelper.createTestUser(dataSource, {
        id: TEST_USER_ID_1,
        email: "test1@example.com",
        password: "testPassword123",
        name: "테스트 사용자1",
      }),
      testHelper.createTestUser(dataSource, {
        id: TEST_USER_ID_2,
        email: "test2@example.com",
        password: "testPassword123",
        name: "테스트 사용자2",
      }),
    ]);

    // Factory counter 초기화
    OrderFactory.resetCounter();
    ProductFactory.resetCounter();
    UserBalanceFactory.resetCounter();
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();
  });

  describe("데이터 일관성 테스트", () => {
    beforeEach(async () => {
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_1,
        name: "테스트 상품",
        price: 10000,
        totalStock: 5,
        reservedStock: 0,
        isActive: true,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID_1,
        balance: 50000,
      });
    });

    it("재고 예약 후 결제 실패 시 재고가 복구되어야 함", async () => {
      // Given: 사용자 잔액을 부족하게 설정 (재고 예약은 성공하지만 결제에서 실패하도록)
      await userBalanceRepository.update(
        { userId: TEST_USER_ID_1 },
        { balance: 5000 } // 10000원 상품을 살 수 없는 금액
      );

      const initialStock = await productRepository.findOne({
        where: { id: TEST_PRODUCT_ID_1 },
      });

      // When: 주문 시도 (잔액 부족으로 실패)
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: null,
          idempotencyKey: "insufficient-balance-order",
          itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
        })
      ).rejects.toThrow(InsufficientPointBalanceError);

      // Then: 재고가 원래대로 복구되어야 함
      const finalStock = await productRepository.findOne({
        where: { id: TEST_PRODUCT_ID_1 },
      });
      expect(finalStock.totalStock).toBe(initialStock.totalStock);
      expect(finalStock.reservedStock).toBe(0);

      // 재고 예약 테이블에 남아있는 예약이 없어야 함
      const reservations = await stockReservationRepository.find({
        where: { productId: TEST_PRODUCT_ID_1, userId: TEST_USER_ID_1 },
      });
      expect(reservations).toHaveLength(0);
    });

    it("주문 실패 후 모든 관련 데이터가 정리되어야 함", async () => {
      // Given: 주문 중간에 실패할 상황 (잔액 부족)
      await userBalanceRepository.update(
        { userId: TEST_USER_ID_1 },
        { balance: 5000 }
      );

      // When: 주문 실패
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: null,
          idempotencyKey: "failed-order-cleanup",
          itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 2 }],
        })
      ).rejects.toThrow();

      // Then: 실패한 주문과 관련된 모든 데이터가 정리되어야 함

      // 1. 재고가 원래대로 복구
      const product = await productRepository.findOne({
        where: { id: TEST_PRODUCT_ID_1 },
      });
      expect(product.totalStock).toBe(5);
      expect(product.reservedStock).toBe(0);

      // 2. 포인트 트랜잭션이 생성되지 않아야 함
      const pointTransactions = await pointTransactionRepository.find({
        where: { userId: TEST_USER_ID_1 },
      });
      expect(pointTransactions).toHaveLength(0);

      // 3. 사용자 잔액이 변하지 않아야 함
      const userBalance = await userBalanceRepository.findOne({
        where: { userId: TEST_USER_ID_1 },
      });
      expect(userBalance.balance).toBe(5000);
    });
  });
});
