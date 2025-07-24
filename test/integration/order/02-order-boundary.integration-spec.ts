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

describe("Order Service Boundary Integration Test", () => {
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

  describe("경계값 테스트", () => {
    beforeEach(async () => {
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_1,
        name: "테스트 상품",
        price: 1,
        totalStock: 1,
        reservedStock: 0,
        isActive: true,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID_1,
        balance: 1,
      });
    });

    it("최소 금액(1원) 주문이 성공해야 함", async () => {
      // When: 1원 주문
      const { order } = await orderService.placeOrder({
        userId: TEST_USER_ID_1,
        couponId: null,
        idempotencyKey: "minimum-price-order",
        itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
      });

      // Then: 주문이 성공해야 함
      expect(order.status).toBe(OrderStatus.SUCCESS);
      expect(order.finalPrice).toBe(1);

      // 잔액이 0이 되어야 함
      const userBalance = await userBalanceRepository.findOne({
        where: { userId: TEST_USER_ID_1 },
      });
      expect(userBalance.balance).toBe(0);
    });

    it("잔액과 주문 금액이 정확히 일치할 때 성공해야 함", async () => {
      // Given: 잔액 10000원, 상품 가격 10000원
      await productRepository.update(
        { id: TEST_PRODUCT_ID_1 },
        { price: 10000 }
      );
      await userBalanceRepository.update(
        { userId: TEST_USER_ID_1 },
        { balance: 10000 }
      );

      // When: 정확히 잔액만큼 주문
      const { order } = await orderService.placeOrder({
        userId: TEST_USER_ID_1,
        couponId: null,
        idempotencyKey: "exact-balance-order",
        itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
      });

      // Then: 주문이 성공하고 잔액이 0이 되어야 함
      expect(order.status).toBe(OrderStatus.SUCCESS);

      const userBalance = await userBalanceRepository.findOne({
        where: { userId: TEST_USER_ID_1 },
      });
      expect(userBalance.balance).toBe(0);
    });

    it("재고가 정확히 0일 때 주문이 실패해야 함", async () => {
      // Given: 재고를 0으로 설정
      await productRepository.update(
        { id: TEST_PRODUCT_ID_1 },
        { totalStock: 0 }
      );

      // When & Then: 주문 시 재고 부족 에러 발생
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: null,
          idempotencyKey: "zero-stock-order",
          itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
        })
      ).rejects.toThrow(InsufficientStockError);
    });
  });
});
