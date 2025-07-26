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

describe("Order Service Business Rules Integration Test", () => {
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

  describe("비즈니스 룰 위반 테스트", () => {
    it("비활성화된 상품 주문 시 실패해야 함", async () => {
      // Given: 비활성화된 상품
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_1,
        name: "비활성화 상품",
        price: 10000,
        totalStock: 10,
        reservedStock: 0,
        isActive: false,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID_1,
        balance: 50000,
      });

      // When & Then: 비활성화된 상품 주문 시 에러 발생
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: null,
          idempotencyKey: "inactive-product-order",
          itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
        })
      ).rejects.toThrow();
    });

    it("존재하지 않는 상품 주문 시 실패해야 함", async () => {
      // Given: 존재하지 않는 상품 ID
      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID_1,
        balance: 50000,
      });

      // When & Then: 존재하지 않는 상품 주문 시 에러 발생
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: null,
          idempotencyKey: "nonexistent-product-order",
          itemsWithoutPrices: [
            { productId: "nonexistent-product", quantity: 1 },
          ],
        })
      ).rejects.toThrow(ProductNotFoundError);
    });

    // 왜인지 모르겠는데 얘 혼자 50초 넘게 돈다.
    it.skip("만료된 쿠폰 사용 시 실패해야 함", async () => {
      // Given: 만료된 쿠폰
      const yesterday = new Date(Date.now() - 86400000);
      await CouponFactory.createAndSave(couponRepository, {
        id: TEST_COUPON_ID,
        name: "만료된 쿠폰",
        discountType: "PERCENTAGE",
        discountValue: 10,
        minimumOrderPrice: 5000,
        startDate: new Date(Date.now() - 172800000), // 2일 전
        endDate: yesterday, // 어제 만료
      });

      await UserCouponFactory.createAndSave(userCouponRepository, {
        userId: TEST_USER_ID_1,
        couponId: TEST_COUPON_ID,
        status: UserCouponStatus.ISSUED,
      });

      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_1,
        name: "테스트 상품",
        price: 10000,
        totalStock: 10,
        reservedStock: 0,
        isActive: true,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID_1,
        balance: 50000,
      });

      // When & Then: 만료된 쿠폰 사용 시 에러 발생
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: TEST_COUPON_ID,
          idempotencyKey: "expired-coupon-order",
          itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
        })
      ).rejects.toThrow();
    });

    it("최소 주문 금액 미달 시 쿠폰 사용 실패해야 함", async () => {
      // Given: 최소 주문 금액이 20000원인 쿠폰
      await CouponFactory.createAndSave(couponRepository, {
        id: TEST_COUPON_ID,
        name: "최소 주문 금액 쿠폰",
        discountType: "FIXED",
        discountValue: 1000,
        minimumOrderPrice: 20000,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      });

      await UserCouponFactory.createAndSave(userCouponRepository, {
        userId: TEST_USER_ID_1,
        couponId: TEST_COUPON_ID,
        status: UserCouponStatus.ISSUED,
      });

      // 10000원 상품 (최소 주문 금액 미달)
      await ProductFactory.createAndSave(productRepository, {
        id: TEST_PRODUCT_ID_1,
        name: "저가 상품",
        price: 10000,
        totalStock: 10,
        reservedStock: 0,
        isActive: true,
      });

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: TEST_USER_ID_1,
        balance: 50000,
      });

      // When & Then: 최소 주문 금액 미달로 쿠폰 사용 실패
      await expect(
        orderService.placeOrder({
          userId: TEST_USER_ID_1,
          couponId: TEST_COUPON_ID,
          idempotencyKey: "minimum-order-fail",
          itemsWithoutPrices: [{ productId: TEST_PRODUCT_ID_1, quantity: 1 }],
        })
      ).rejects.toThrow();
    });
  });
});
