import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { OrderItemRepository } from "@/order/infrastructure/persistence/order-item.repository";
import {
  OrderTypeOrmEntity,
  OrderStatus,
} from "@/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "@/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { OrderFactory } from "@/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "@/order/infrastructure/persistence/factories/order-item.factory";
import { TypeOrmModule } from "@nestjs/typeorm";

describe("OrderItemRepository Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let orderItemRepository: OrderItemRepository;
  let orderOrmRepository: Repository<OrderTypeOrmEntity>;
  let orderItemOrmRepository: Repository<OrderItemTypeOrmEntity>;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupWithMySQL();
    dataSource = setup.dataSource;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forFeature([OrderTypeOrmEntity, OrderItemTypeOrmEntity]),
      ],
      providers: [OrderItemRepository],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    orderItemRepository =
      moduleFixture.get<OrderItemRepository>(OrderItemRepository);
    orderOrmRepository = dataSource.getRepository(OrderTypeOrmEntity);
    orderItemOrmRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource);
    OrderFactory.resetCounter();
    OrderItemFactory.resetCounter();
  });

  describe("findPopularProducts - Complex Aggregation Query with Join", () => {
    it("성공한 주문의 상품들을 수량 기준으로 인기순 조회해야 함", async () => {
      // Given: 여러 주문과 주문 아이템들 생성

      // 성공한 주문들
      const successOrder1 = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-1",
          status: OrderStatus.SUCCESS,
        }
      );

      const successOrder2 = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-2",
          status: OrderStatus.SUCCESS,
        }
      );

      const successOrder3 = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-3",
          status: OrderStatus.SUCCESS,
        }
      );

      // 실패한 주문 (집계에서 제외되어야 함)
      const failedOrder = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-4",
        status: OrderStatus.FAILED,
      });

      // 주문 아이템들 생성
      // Product A: 총 수량 12 (3개 주문)
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder1.id,
        productId: "product-A",
        quantity: 5,
      });
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder2.id,
        productId: "product-A",
        quantity: 3,
      });
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder3.id,
        productId: "product-A",
        quantity: 4,
      });

      // Product B: 총 수량 8 (2개 주문)
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder1.id,
        productId: "product-B",
        quantity: 2,
      });
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder2.id,
        productId: "product-B",
        quantity: 6,
      });

      // Product C: 총 수량 3 (1개 주문)
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder3.id,
        productId: "product-C",
        quantity: 3,
      });

      // 실패한 주문의 아이템 (집계에서 제외되어야 함)
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: failedOrder.id,
        productId: "product-D",
        quantity: 100, // 많은 수량이지만 실패한 주문이므로 제외
      });

      // When: 인기 상품 조회 (limit 10)
      const popularProducts = await orderItemRepository.findPopularProducts(10);

      // Then: 수량 기준 내림차순으로 정렬되어야 함
      expect(popularProducts).toHaveLength(3); // 성공한 주문의 상품들만

      // 첫 번째: Product A (총 수량 12, 주문 수 3)
      expect(popularProducts[0].productId).toBe("product-A");
      expect(popularProducts[0].totalQuantity).toBe(12);
      expect(popularProducts[0].totalOrders).toBe(3);

      // 두 번째: Product B (총 수량 8, 주문 수 2)
      expect(popularProducts[1].productId).toBe("product-B");
      expect(popularProducts[1].totalQuantity).toBe(8);
      expect(popularProducts[1].totalOrders).toBe(2);

      // 세 번째: Product C (총 수량 3, 주문 수 1)
      expect(popularProducts[2].productId).toBe("product-C");
      expect(popularProducts[2].totalQuantity).toBe(3);
      expect(popularProducts[2].totalOrders).toBe(1);

      // Product D는 실패한 주문이므로 포함되지 않아야 함
      expect(popularProducts.some((p) => p.productId === "product-D")).toBe(
        false
      );
    });

    it("limit 파라미터가 올바르게 작동해야 함", async () => {
      // Given: 5개의 다른 상품들
      const orders = [];
      for (let i = 0; i < 5; i++) {
        const order = await OrderFactory.createAndSave(orderOrmRepository, {
          userId: `user-${i}`,
          status: OrderStatus.SUCCESS,
        });
        orders.push(order);
      }

      // 각각 다른 수량으로 주문 아이템 생성
      for (let i = 0; i < 5; i++) {
        await OrderItemFactory.createAndSave(orderItemOrmRepository, {
          orderId: orders[i].id,
          productId: `product-${i}`,
          quantity: 5 - i, // 5, 4, 3, 2, 1 순서로 수량 설정
        });
      }

      // When: limit 3으로 조회
      const popularProducts = await orderItemRepository.findPopularProducts(3);

      // Then: 3개만 반환되어야 함
      expect(popularProducts).toHaveLength(3);
      expect(popularProducts[0].totalQuantity).toBe(5); // product-0
      expect(popularProducts[1].totalQuantity).toBe(4); // product-1
      expect(popularProducts[2].totalQuantity).toBe(3); // product-2
    });

    it("동일한 상품이 여러 주문에 있을 때 올바르게 집계되어야 함", async () => {
      const productId = "popular-product";

      // Given: 동일한 상품을 주문한 여러 주문들
      const orders = [];
      for (let i = 0; i < 5; i++) {
        const order = await OrderFactory.createAndSave(orderOrmRepository, {
          userId: `user-${i}`,
          status: OrderStatus.SUCCESS,
        });
        orders.push(order);

        // 각 주문에서 동일한 상품을 다른 수량으로 주문
        await OrderItemFactory.createAndSave(orderItemOrmRepository, {
          orderId: order.id,
          productId: productId,
          quantity: i + 1, // 1, 2, 3, 4, 5
        });
      }

      // When: 인기 상품 조회
      const popularProducts = await orderItemRepository.findPopularProducts(10);

      // Then: 동일한 상품이 하나로 집계되어야 함
      expect(popularProducts).toHaveLength(1);
      expect(popularProducts[0].productId).toBe(productId);
      expect(popularProducts[0].totalQuantity).toBe(15); // 1+2+3+4+5
      expect(popularProducts[0].totalOrders).toBe(5); // 5개의 별개 주문
    });

    it("한 주문에 동일한 상품이 여러 아이템으로 있을 때 올바르게 집계되어야 함", async () => {
      const productId = "repeated-product";

      // Given: 동일한 주문에 같은 상품이 여러 번
      const order = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-123",
        status: OrderStatus.SUCCESS,
      });

      // 같은 주문에 같은 상품을 여러 번 추가
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: order.id,
        productId: productId,
        quantity: 3,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: order.id,
        productId: productId,
        quantity: 2,
      });

      // When: 인기 상품 조회
      const popularProducts = await orderItemRepository.findPopularProducts(10);

      // Then: 수량은 합계되고 주문 수는 고유하게 계산되어야 함
      expect(popularProducts).toHaveLength(1);
      expect(popularProducts[0].productId).toBe(productId);
      expect(popularProducts[0].totalQuantity).toBe(5); // 3 + 2
      expect(popularProducts[0].totalOrders).toBe(1); // 하나의 주문
    });

    it("PENDING과 CANCELLED 주문은 집계에서 제외되어야 함", async () => {
      const productId = "test-product";

      // Given: 다양한 상태의 주문들
      const successOrder = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-1",
          status: OrderStatus.SUCCESS,
        }
      );

      const pendingOrder = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-2",
          status: OrderStatus.PENDING,
        }
      );

      const cancelledOrder = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-3",
          status: OrderStatus.CANCELLED,
        }
      );

      const failedOrder = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-4",
        status: OrderStatus.FAILED,
      });

      // 각 주문에 동일한 상품 추가
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: successOrder.id,
        productId: productId,
        quantity: 5,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: pendingOrder.id,
        productId: productId,
        quantity: 10,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: cancelledOrder.id,
        productId: productId,
        quantity: 15,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: failedOrder.id,
        productId: productId,
        quantity: 20,
      });

      // When: 인기 상품 조회
      const popularProducts = await orderItemRepository.findPopularProducts(10);

      // Then: SUCCESS 주문만 집계되어야 함
      expect(popularProducts).toHaveLength(1);
      expect(popularProducts[0].productId).toBe(productId);
      expect(popularProducts[0].totalQuantity).toBe(5); // SUCCESS 주문만
      expect(popularProducts[0].totalOrders).toBe(1);
    });

    it("빈 결과를 올바르게 처리해야 함", async () => {
      // Given: 성공한 주문이 없음 (모든 주문이 실패)
      const failedOrder = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-1",
        status: OrderStatus.FAILED,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: failedOrder.id,
        productId: "product-1",
        quantity: 10,
      });

      // When: 인기 상품 조회
      const popularProducts = await orderItemRepository.findPopularProducts(10);

      // Then: 빈 배열 반환
      expect(popularProducts).toHaveLength(0);
    });

    it("수량이 0인 주문 아이템은 집계에서 제외되어야 함", async () => {
      // Given: 수량이 0인 주문 아이템
      const order = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-1",
        status: OrderStatus.SUCCESS,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: order.id,
        productId: "product-zero",
        quantity: 0, // 수량 0
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: order.id,
        productId: "product-normal",
        quantity: 5,
      });

      // When: 인기 상품 조회
      const popularProducts = await orderItemRepository.findPopularProducts(10);

      // Then: 수량이 0인 상품은 제외되거나 0으로 집계
      expect(popularProducts).toHaveLength(2);

      const zeroProduct = popularProducts.find(
        (p) => p.productId === "product-zero"
      );
      const normalProduct = popularProducts.find(
        (p) => p.productId === "product-normal"
      );

      expect(zeroProduct.totalQuantity).toBe(0);
      expect(normalProduct.totalQuantity).toBe(5);
    });
  });

  describe("Performance Tests", () => {
    it("대량 데이터에서 집계 쿼리 성능이 적절해야 함", async () => {
      const orderCount = 100;
      const itemsPerOrder = 5;
      const uniqueProducts = 20;

      // Given: 대량의 주문과 주문 아이템 데이터
      for (let i = 0; i < orderCount; i++) {
        const order = await OrderFactory.createAndSave(orderOrmRepository, {
          userId: `user-${i}`,
          status: i % 4 === 0 ? OrderStatus.FAILED : OrderStatus.SUCCESS, // 25%는 실패
        });

        // 각 주문에 여러 아이템 추가
        for (let j = 0; j < itemsPerOrder; j++) {
          await OrderItemFactory.createAndSave(orderItemOrmRepository, {
            orderId: order.id,
            productId: `product-${j % uniqueProducts}`, // 20개 상품을 순환
            quantity: Math.floor(Math.random() * 10) + 1, // 1-10 랜덤 수량
          });
        }
      }

      // When: 성능 측정하며 집계 쿼리 실행
      const startTime = Date.now();
      const popularProducts = await orderItemRepository.findPopularProducts(10);
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Then: 성능 및 정확성 검증
      expect(popularProducts).toHaveLength(10); // limit 적용 확인
      expect(popularProducts.every((p) => p.totalQuantity > 0)).toBe(true);
      expect(popularProducts.every((p) => p.totalOrders > 0)).toBe(true);
      expect(queryTime).toBeLessThan(1000); // 1초 이내

      // 정렬 순서 확인 (내림차순)
      for (let i = 1; i < popularProducts.length; i++) {
        expect(popularProducts[i - 1].totalQuantity).toBeGreaterThanOrEqual(
          popularProducts[i].totalQuantity
        );
      }

      console.log(
        `Aggregation query on ${orderCount * itemsPerOrder} order items took ${queryTime}ms`
      );
      console.log(
        `Top product: ${popularProducts[0].productId} with ${popularProducts[0].totalQuantity} total quantity`
      );
    });
  });
});
