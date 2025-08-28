import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../../test-environment/test-environment.factory";
import { MockRedisManager } from "../../test-environment/mocks/redis-manager";
import { OrderFactory } from "@/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "@/order/infrastructure/persistence/factories/order-item.factory";
import {
  OrderStatus,
  OrderTypeOrmEntity,
} from "@/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "@/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { UserBalanceTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "@/wallet/infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { ProductTypeOrmEntity } from "@/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "@/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { CouponTypeOrmEntity } from "@/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import {
  UserCouponStatus,
  UserCouponTypeOrmEntity,
} from "@/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { UserTypeOrmEntity } from "@/user/infrastructure/persistence/orm/user.typeorm.entity";
import { PlaceOrderUseCase } from "@/order/application/use-cases/tier-4/place-order.use-case";
import { PrepareOrderUseCase } from "@/order/application/use-cases/tier-3/prepare-order.use-case";
import { ProcessOrderUseCase } from "@/order/application/use-cases/tier-2/process-order.use-case";
import { RecoverOrderUseCase } from "@/order/application/use-cases/tier-2/recover-order.use-case";
import { CreateOrderUseCase } from "@/order/application/use-cases/tier-1-in-domain/create-order.use-case";
import { ApplyDiscountUseCase } from "@/order/application/use-cases/tier-1-in-domain/apply-discount.use-case";
import { ChangeOrderStatusUseCase } from "@/order/application/use-cases/tier-1-in-domain/change-order-status.use-case";
import { GetProductsPriceUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-products-price.use-case";
import { ReserveStocksUseCase } from "@/product/application/use-cases/tier-2/reserve-stocks.use-case";
import { ReserveStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/reserve-stock.use-case";
import { ReleaseStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { ConfirmStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { GetProductByIdUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-product-by-id.use-case";
import { GetProductsByIdsUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-products-by-ids.use-case";
import { ValidateUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/validate-user-coupon.use-case";
import { UseUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { RecoverUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { ValidateUsePointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/validate-use-points.use-case";
import { UsePointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/use-points.use-case";
import { RecoverPointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";
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
import { ProductFactory } from "@/product/infrastructure/persistence/factories/product.factory";
import { UserBalanceFactory } from "@/wallet/infrastructure/persistence/factories/user-balance.factory";
import { CouponFactory } from "@/coupon/infrastructure/persistence/factories/coupon.factory";
import { UserCouponFactory } from "@/coupon/infrastructure/persistence/factories/user-coupon.factory";
import { OrderItemRedisRepository } from "@/order/infrastructure/persistence/order-item-redis.repository";
import { CacheInvalidationService } from "@/common/infrastructure/cache/cache-invalidation.service";
import { UpdateProductRankingUseCase } from "@/order/application/use-cases/tier-1-in-domain/update-product-ranking.use-case";
import { CacheService } from "@/common/infrastructure/cache/cache.service";
import { RedisManager } from "@/common/infrastructure/config/redis.config";

describe("Order Concurrency Integration Tests", () => {
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;
  let dataSource: DataSource;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let orderItemRepository: Repository<OrderItemTypeOrmEntity>;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let stockReservationRepository: Repository<StockReservationTypeOrmEntity>;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let pointTransactionRepository: Repository<PointTransactionTypeOrmEntity>;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let userRepository: Repository<UserTypeOrmEntity>;
  let placeOrderUseCase: PlaceOrderUseCase;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createDatabaseOnlyEnvironment();
    dataSource = environment.dataSource;

    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
    orderItemRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    stockReservationRepository = dataSource.getRepository(
      StockReservationTypeOrmEntity
    );
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
    pointTransactionRepository = dataSource.getRepository(
      PointTransactionTypeOrmEntity
    );
    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    userRepository = dataSource.getRepository(UserTypeOrmEntity);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        // Repository tokens
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
          provide: getRepositoryToken(UserBalanceTypeOrmEntity),
          useValue: userBalanceRepository,
        },
        {
          provide: getRepositoryToken(PointTransactionTypeOrmEntity),
          useValue: pointTransactionRepository,
        },
        {
          provide: getRepositoryToken(CouponTypeOrmEntity),
          useValue: couponRepository,
        },
        {
          provide: getRepositoryToken(UserCouponTypeOrmEntity),
          useValue: userCouponRepository,
        },
        // Repositories
        OrderRepository,
        OrderItemRepository,
        ProductRepository,
        StockReservationRepository,
        UserBalanceRepository,
        PointTransactionRepository,
        CouponRepository,
        UserCouponRepository,
        // Domain Services
        ValidateStockService,
        ValidateUserCouponService,
        ValidatePointTransactionService,
        // Product Use Cases
        GetProductByIdUseCase,
        GetProductsByIdsUseCase,
        GetProductsPriceUseCase,
        ReserveStockUseCase,
        ReleaseStockUseCase,
        ConfirmStockUseCase,
        ReserveStocksUseCase,
        // Coupon Use Cases
        ValidateUserCouponUseCase,
        UseUserCouponUseCase,
        RecoverUserCouponUseCase,
        // Wallet Use Cases
        ValidateUsePointsUseCase,
        UsePointsUseCase,
        RecoverPointsUseCase,
        // Order Use Cases
        CreateOrderUseCase,
        ApplyDiscountUseCase,
        ChangeOrderStatusUseCase,
        PrepareOrderUseCase,
        ProcessOrderUseCase,
        RecoverOrderUseCase,
        PlaceOrderUseCase,
        UpdateProductRankingUseCase,
        CacheInvalidationService,
        CacheService,
        OrderItemRedisRepository,
        {
          provide: RedisManager,
          useValue: MockRedisManager,
        },
      ],
    }).compile();

    placeOrderUseCase = moduleFixture.get<PlaceOrderUseCase>(PlaceOrderUseCase);
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.dataHelper.createTestUser();

    // Create test users for concurrent orders
    const testUsers = Array.from({ length: 20 }, (_, i) => ({
      id: `test-user-${i}`,
      email: `testuser${i}@example.com`,
      password: "hashed_password",
      name: `테스트 사용자 ${i}`,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await userRepository.save(testUsers);

    // Reset factory counters
    OrderFactory.resetCounter();
    OrderItemFactory.resetCounter();
    ProductFactory.resetCounter();
    UserBalanceFactory.resetCounter();
    CouponFactory.resetCounter();
    UserCouponFactory.resetCounter();
  });

  describe("제한된 재고에 대한 동시 주문 테스트", () => {
    it("제한된 재고 상품에 동시 주문 시 재고 한도 내에서만 성공해야 함", async () => {
      // Given: 제한된 재고 상품 생성
      const totalStock = 10;
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Limited Stock Product",
        price: 15000,
        totalStock: totalStock,
        reservedStock: 0,
        isActive: true,
      });

      // 각 사용자에게 충분한 포인트 제공
      const userBalances = [];
      for (let i = 0; i < 15; i++) {
        const balance = await UserBalanceFactory.createAndSave(
          userBalanceRepository,
          {
            userId: `test-user-${i}`,
            balance: 50000,
          }
        );
        userBalances.push(balance);
      }

      const orderQuantity = 2;
      const concurrentOrders = 8; // 2개씩 8번 = 16개 주문 (10개 재고 초과)

      // When: 동시에 여러 사용자가 동일한 상품 주문
      const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
        placeOrderUseCase
          .execute({
            userId: `test-user-${i}`,
            userCouponId: null,
            idempotencyKey: `concurrent-order-${i}`,
            itemsWithoutPrices: [
              {
                productId: product.id,
                quantity: orderQuantity,
              },
            ],
          })
          .catch((error) => ({ error }))
      );

      const results = await Promise.all(orderPromises);

      // Then: 재고 한도 내에서만 성공해야 함
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      const maxPossibleOrders = Math.floor(totalStock / orderQuantity); // 5개
      expect(successes.length).toBe(maxPossibleOrders);
      expect(failures.length).toBe(concurrentOrders - maxPossibleOrders);

      // 성공한 주문들의 상태 검증
      const successfulOrders = await orderRepository.find({
        where: { status: OrderStatus.SUCCESS },
      });
      expect(successfulOrders).toHaveLength(maxPossibleOrders);

      // 상품의 총 재고가 정확히 차감되었는지 확인
      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.totalStock).toBe(
        totalStock - maxPossibleOrders * orderQuantity
      );
      expect(updatedProduct.reservedStock).toBe(0);
    });

    it("재고가 부족한 상품에 동시 주문 시도 시 모두 실패해야 함", async () => {
      // Given: 재고가 0인 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Out of Stock Product",
        price: 10000,
        totalStock: 0,
        reservedStock: 0,
        isActive: true,
      });

      // 사용자들에게 충분한 포인트 제공
      for (let i = 0; i < 5; i++) {
        await UserBalanceFactory.createAndSave(userBalanceRepository, {
          userId: `test-user-${i}`,
          balance: 30000,
        });
      }

      const concurrentOrders = 5;

      // When: 동시에 재고 없는 상품 주문
      const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
        placeOrderUseCase
          .execute({
            userId: `test-user-${i}`,
            userCouponId: null,
            idempotencyKey: `no-stock-order-${i}`,
            itemsWithoutPrices: [
              {
                productId: product.id,
                quantity: 1,
              },
            ],
          })
          .catch((error) => ({ error }))
      );

      const results = await Promise.all(orderPromises);

      // Then: 모든 주문이 실패해야 함
      const failures = results.filter((result) => "error" in result);
      expect(failures.length).toBe(concurrentOrders);

      // 실패한 주문이 없어야 함
      const orders = await orderRepository.find();
      const successfulOrders = orders.filter(
        (order) => order.status === OrderStatus.SUCCESS
      );
      expect(successfulOrders).toHaveLength(0);
    });
  });

  describe("포인트 잔액 부족 시 동시 주문 테스트", () => {
    it("제한된 포인트로 동시 주문 시 잔액 한도 내에서만 성공해야 함", async () => {
      // Given: 충분한 재고의 상품
      const orderValue = 15000;
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Sufficient Stock Product",
        price: orderValue, // 테스트 변수와 일치시킴
        totalStock: 100,
        reservedStock: 0,
        isActive: true,
      });

      // 제한된 포인트 잔액 설정 (총 50,000 포인트)
      const totalPoints = 50000;
      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: "test-user-0",
        balance: totalPoints,
      });
      const concurrentOrders = 5; // 5번 주문 시도 (총 75,000 포인트 필요, 50,000 포인트만 보유)

      // When: 동일한 사용자가 동시에 여러 주문
      const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
        placeOrderUseCase
          .execute({
            userId: "test-user-0",
            userCouponId: null,
            idempotencyKey: `limited-points-order-${i}`,
            itemsWithoutPrices: [
              {
                productId: product.id,
                quantity: 1,
              },
            ],
          })
          .catch((error) => ({ error }))
      );

      const results = await Promise.all(orderPromises);

      // Then: 포인트 잔액 한도 내에서만 성공해야 함
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      const maxPossibleOrders = Math.floor(totalPoints / orderValue); // 3개
      expect(successes.length).toBe(maxPossibleOrders);
      expect(failures.length).toBe(concurrentOrders - maxPossibleOrders);

      // 최종 잔액이 알맞은 숫자이어야 함
      const finalBalance = await userBalanceRepository.findOne({
        where: { userId: "test-user-0" },
      });
      expect(finalBalance.balance).toBe(
        totalPoints - successes.length * orderValue
      );
    });
  });

  describe("쿠폰 사용 동시성 테스트", () => {
    it("동일한 사용자가 같은 쿠폰으로 동시 주문 시도 시 하나만 성공해야 함", async () => {
      // Given: 쿠폰과 상품 생성
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "SAMEUSER",
        discountValue: 1000,
        discountType: "FIXED",
        totalCount: 100,
        issuedCount: 1,
        minimumOrderPrice: 5000,
        endDate: new Date(Date.now() + 86400000),
      });

      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Product for Same User Test",
        price: 10000,
        totalStock: 50,
        reservedStock: 0,
        isActive: true,
      });

      // 사용자에게 쿠폰 발급 및 충분한 포인트 제공
      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: "test-user-0",
        balance: 100000,
      });

      const userCoupon = await UserCouponFactory.createAndSave(
        userCouponRepository,
        {
          couponId: coupon.id,
          userId: "test-user-0",
          status: UserCouponStatus.ISSUED,
        }
      );

      const concurrentOrders = 5;

      // When: 동일한 사용자가 같은 쿠폰으로 동시 주문
      const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
        placeOrderUseCase
          .execute({
            userId: "test-user-0",
            userCouponId: userCoupon.id,
            idempotencyKey: `same-user-coupon-order-${i}`,
            itemsWithoutPrices: [
              {
                productId: product.id,
                quantity: 1,
              },
            ],
          })
          .catch((error) => ({ error }))
      );

      const results = await Promise.all(orderPromises);

      // Then: 하나만 성공해야 함 (쿠폰은 한 번만 사용 가능)
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(concurrentOrders - 1);

      // 쿠폰이 USED 상태로 변경되었는지 확인
      const updatedUserCoupon = await userCouponRepository.findOne({
        where: { id: userCoupon.id },
      });
      expect(updatedUserCoupon.status).toBe(UserCouponStatus.USED);
    });
  });

  describe("복합 시나리오 동시성 테스트", () => {
    it("제한된 재고 + 제한된 포인트 + 제한된 쿠폰의 복합 동시 주문 시나리오", async () => {
      // Given: 복합 제약 조건 설정
      const limitedStock = 8;
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Complex Scenario Product",
        price: 15000,
        totalStock: limitedStock,
        reservedStock: 0,
        isActive: true,
      });

      const limitedCouponCount = 6;
      const coupon = await CouponFactory.createAndSave(couponRepository, {
        couponCode: "COMPLEX_LIMITED",
        discountValue: 5000,
        discountType: "FIXED",
        totalCount: limitedCouponCount,
        issuedCount: limitedCouponCount,
        minimumOrderPrice: 10000,
        endDate: new Date(Date.now() + 86400000),
      });

      // 사용자별 다양한 조건 설정
      const userScenarios = [
        // 0-2: 쿠폰 있음, 충분한 포인트
        { hasCoupon: true, points: 50000 },
        { hasCoupon: true, points: 50000 },
        { hasCoupon: true, points: 50000 },
        // 3-5: 쿠폰 있음, 제한된 포인트
        { hasCoupon: true, points: 12000 }, // 쿠폰 사용 시 가능
        { hasCoupon: true, points: 8000 }, // 쿠폰 사용해도 부족
        { hasCoupon: true, points: 11000 }, // 쿠폰 사용 시 가능
        // 6-9: 쿠폰 없음, 다양한 포인트
        { hasCoupon: false, points: 20000 }, // 충분
        { hasCoupon: false, points: 10000 }, // 부족
        { hasCoupon: false, points: 20000 }, // 충분
        { hasCoupon: false, points: 5000 }, // 부족
      ];

      const userCoupons = [];
      for (let i = 0; i < userScenarios.length; i++) {
        const scenario = userScenarios[i];

        await UserBalanceFactory.createAndSave(userBalanceRepository, {
          userId: `test-user-${i}`,
          balance: scenario.points,
        });

        if (scenario.hasCoupon) {
          const userCoupon = await UserCouponFactory.createAndSave(
            userCouponRepository,
            {
              couponId: coupon.id,
              userId: `test-user-${i}`,
              status: UserCouponStatus.ISSUED,
            }
          );
          userCoupons.push(userCoupon);
        }
      }

      // When: 복합 조건에서 동시 주문
      const orderPromises = userScenarios.map((scenario, i) => {
        const userCouponId = scenario.hasCoupon
          ? userCoupons.find((uc) => uc.userId === `test-user-${i}`)?.id || null
          : null;

        return placeOrderUseCase
          .execute({
            userId: `test-user-${i}`,
            userCouponId,
            idempotencyKey: `complex-order-${i}`,
            itemsWithoutPrices: [
              {
                productId: product.id,
                quantity: 1,
              },
            ],
          })
          .catch((error) => ({ error, userId: `test-user-${i}` }));
      });

      const results = await Promise.all(orderPromises);

      // Then: 결과 분석
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      // 재고 제한이 가장 엄격한 제약이므로, 성공한 주문은 재고 한도를 넘지 않아야 함
      expect(successes.length).toBeLessThanOrEqual(limitedStock);

      // 최종 상태 검증
      const finalProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(finalProduct.totalStock).toBe(limitedStock - successes.length);

      // 성공한 주문들이 모두 SUCCESS 상태인지 확인
      const successfulOrders = await orderRepository.find({
        where: { status: OrderStatus.SUCCESS },
      });
      expect(successfulOrders).toHaveLength(successes.length);
    });

    it("동시 주문 시 실패한 주문의 복구 프로세스 검증", async () => {
      // Given: 복구 테스트를 위한 시나리오 설정
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Recovery Test Product",
        price: 20000,
        totalStock: 3, // 매우 제한된 재고
        reservedStock: 0,
        isActive: true,
      });

      // 사용자들에게 충분한 포인트와 쿠폰 제공
      const userCount = 6;
      const userCoupons = [];

      for (let i = 0; i < userCount; i++) {
        await UserBalanceFactory.createAndSave(userBalanceRepository, {
          userId: `test-user-${i}`,
          balance: 30000,
        });

        const coupon = await CouponFactory.createAndSave(couponRepository, {
          couponCode: `RECOVERY_${i}`,
          discountValue: 3000,
          discountType: "FIXED",
          totalCount: 1,
          issuedCount: 1,
          minimumOrderPrice: 15000,
          endDate: new Date(Date.now() + 86400000),
        });

        const userCoupon = await UserCouponFactory.createAndSave(
          userCouponRepository,
          {
            couponId: coupon.id,
            userId: `test-user-${i}`,
            status: UserCouponStatus.ISSUED,
          }
        );
        userCoupons.push(userCoupon);
      }

      // When: 동시 주문 (일부는 성공, 일부는 실패)
      const orderPromises = Array.from({ length: userCount }, (_, i) =>
        placeOrderUseCase
          .execute({
            userId: `test-user-${i}`,
            userCouponId: userCoupons[i].id,
            idempotencyKey: `recovery-order-${i}`,
            itemsWithoutPrices: [
              {
                productId: product.id,
                quantity: 1,
              },
            ],
          })
          .catch((error) => ({ error, userId: `test-user-${i}` }))
      );

      const results = await Promise.all(orderPromises);

      // Then: 결과 분석
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      expect(successes.length).toBe(3); // 재고 한도
      expect(failures.length).toBe(3);

      // 실패한 주문들의 복구 상태 검증
      for (const failure of failures) {
        const userId = failure.userId;

        // 포인트가 원복되었는지 확인
        const userBalance = await userBalanceRepository.findOne({
          where: { userId },
        });
        expect(userBalance.balance).toBe(30000); // 원래 잔액으로 복구

        // 쿠폰이 원복되었는지 확인
        const userCoupon = await userCouponRepository.findOne({
          where: { userId },
        });
        expect(userCoupon.status).toBe(UserCouponStatus.ISSUED); // 사용 전 상태로 복구
      }

      // 성공한 주문들의 상태 확인
      for (const success of successes) {
        // 타입 가드: 성공한 결과만 처리
        if ("error" in success) continue;

        const order = success.order;
        const userId = order.userId;

        // 포인트가 정확히 차감되었는지 확인
        const userBalance = await userBalanceRepository.findOne({
          where: { userId },
        });
        expect(userBalance.balance).toBe(13000); // 30000 - 17000 (할인 적용 후)

        // 쿠폰이 사용됨으로 표시되었는지 확인
        const userCoupon = await userCouponRepository.findOne({
          where: { userId },
        });
        expect(userCoupon.status).toBe(UserCouponStatus.USED);
      }

      // 재고가 정확히 차감되었는지 확인
      const finalProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(finalProduct.totalStock).toBe(0); // 3 - 3 = 0
      expect(finalProduct.reservedStock).toBe(0); // 모든 예약이 확정됨
    });
  });
});
