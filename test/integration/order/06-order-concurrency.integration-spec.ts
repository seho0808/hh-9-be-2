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

describe("Order Service Concurrency Integration Test", () => {
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

  describe.skip("동시성 이슈 테스트", () => {
    beforeEach(async () => {
      // 재고가 1개만 있는 상품 생성
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_1,
        name: "한정 상품",
        price: 10000,
        totalStock: 1,
        reservedStock: 0,
        isActive: true,
      });

      // 사용자들에게 충분한 잔액 제공
      await Promise.all([
        UserBalanceFactory.createAndSave(userBalanceRepository, {
          userId: TEST_USER_ID_1,
          balance: 50000,
        }),
        UserBalanceFactory.createAndSave(userBalanceRepository, {
          userId: TEST_USER_ID_2,
          balance: 50000,
        }),
      ]);
    });

    it("동시에 같은 상품을 주문할 때 한 명만 성공해야 함", async () => {
      // Given: 두 사용자가 동시에 마지막 재고 1개를 주문
      const order1Promise = orderService.placeOrder({
        userId: TEST_USER_ID_1,
        couponId: null,
        idempotencyKey: "concurrent-order-1",
        itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
      });

      const order2Promise = orderService.placeOrder({
        userId: TEST_USER_ID_2,
        couponId: null,
        idempotencyKey: "concurrent-order-2",
        itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
      });

      // When: 두 주문을 동시에 실행
      const results = await Promise.allSettled([order1Promise, order2Promise]);

      // Then: 한 주문은 성공, 다른 주문은 실패해야 함
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failureCount = results.filter(
        (result) => result.status === "rejected"
      ).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // 실패한 주문은 재고 부족 에러여야 함
      const failedResult = results.find(
        (result) => result.status === "rejected"
      ) as PromiseRejectedResult;
      expect(failedResult.reason).toBeInstanceOf(InsufficientStockError);

      // 상품 재고가 0이 되어야 함
      const product = await productRepository.findOne({
        where: { id: TEST_PRODUCT_ID_1 },
      });
      expect(product.totalStock).toBe(0);
    });

    it("동시에 잔액 한계까지 주문할 때 정확히 처리되어야 함", async () => {
      // Given: 사용자의 잔액을 20000원으로 제한
      await userBalanceRepository.update(
        { userId: TEST_USER_ID_1 },
        { balance: 20000 }
      );

      // 10000원 상품 2개 생성
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_2,
        name: "일반 상품",
        price: 10000,
        totalStock: 10,
        reservedStock: 0,
        isActive: true,
      });

      // When: 동시에 10000원씩 2번 주문 (총 20000원)
      const order1Promise = orderService.placeOrder({
        userId: TEST_USER_ID_1,
        couponId: null,
        idempotencyKey: "balance-limit-1",
        itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
      });

      const order2Promise = orderService.placeOrder({
        userId: TEST_USER_ID_1,
        couponId: null,
        idempotencyKey: "balance-limit-2",
        itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_2, quantity: 1 }],
      });

      const results = await Promise.allSettled([order1Promise, order2Promise]);

      // Then: 한 주문은 성공, 다른 주문은 잔액 부족으로 실패
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failureCount = results.filter(
        (result) => result.status === "rejected"
      ).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // 실패한 주문은 잔액 부족 에러여야 함
      const failedResult = results.find(
        (result) => result.status === "rejected"
      ) as PromiseRejectedResult;
      expect(failedResult.reason).toBeInstanceOf(InsufficientPointBalanceError);
    });
  });
});
