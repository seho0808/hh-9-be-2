import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { OrderRepository } from "../../../src/order/infrastructure/persistence/order.repository";
import {
  OrderTypeOrmEntity,
  OrderStatus,
} from "../../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { OrderFactory } from "../../../src/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "../../../src/order/infrastructure/persistence/factories/order-item.factory";
import { TypeOrmModule } from "@nestjs/typeorm";

describe("OrderRepository Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let orderRepository: OrderRepository;
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
      providers: [OrderRepository],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    orderRepository = moduleFixture.get<OrderRepository>(OrderRepository);
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

  describe("findStalePendingOrders - Complex Time-based Query", () => {
    it("만료 시간이 지난 PENDING 주문들만 조회해야 함", async () => {
      const now = new Date();

      // Given: 다양한 시간과 상태의 주문들 생성
      // 30분 전 PENDING 주문 (만료)
      const stalePendingOrder = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-123",
          status: OrderStatus.PENDING,
          createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30분 전
        }
      );

      // 10분 전 PENDING 주문 (아직 유효)
      await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-123",
        status: OrderStatus.PENDING,
        createdAt: new Date(now.getTime() - 10 * 60 * 1000), // 10분 전
      });

      // 30분 전 SUCCESS 주문 (만료되었지만 PENDING이 아님)
      await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-123",
        status: OrderStatus.SUCCESS,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30분 전
      });

      // 1시간 전 PENDING 주문 (만료)
      const veryStaleOrder = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-123",
          status: OrderStatus.PENDING,
          createdAt: new Date(now.getTime() - 60 * 60 * 1000), // 1시간 전
        }
      );

      // When: 20분 타임아웃으로 만료된 주문들 조회
      const staleOrders = await orderRepository.findStalePendingOrders(20, 100);

      // Then: 20분 이전에 생성된 PENDING 주문들만 반환되어야 함
      expect(staleOrders).toHaveLength(2);

      const orderIds = staleOrders.map((order) => order.id);
      expect(orderIds).toContain(stalePendingOrder.id);
      expect(orderIds).toContain(veryStaleOrder.id);

      // 모든 반환된 주문이 PENDING 상태인지 확인
      expect(
        staleOrders.every((order) => order.status === OrderStatus.PENDING)
      ).toBe(true);
    });

    it("limit 파라미터가 올바르게 작동해야 함", async () => {
      const now = new Date();

      // Given: 10개의 만료된 PENDING 주문들 생성
      for (let i = 0; i < 10; i++) {
        await OrderFactory.createAndSave(orderOrmRepository, {
          userId: `user-${i}`,
          status: OrderStatus.PENDING,
          createdAt: new Date(now.getTime() - (30 + i) * 60 * 1000), // 30분 이상 전
        });
      }

      // When: limit을 5로 설정하여 조회
      const staleOrders = await orderRepository.findStalePendingOrders(20, 5);

      // Then: 5개만 반환되어야 함
      expect(staleOrders).toHaveLength(5);
      expect(
        staleOrders.every((order) => order.status === OrderStatus.PENDING)
      ).toBe(true);
    });

    it("생성일 기준 오름차순 정렬이 올바르게 작동해야 함", async () => {
      const now = new Date();

      // Given: 다른 시간에 생성된 만료 주문들
      const order1 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-1",
        status: OrderStatus.PENDING,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000), // 1시간 전
      });

      const order2 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-2",
        status: OrderStatus.PENDING,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30분 전
      });

      const order3 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-3",
        status: OrderStatus.PENDING,
        createdAt: new Date(now.getTime() - 45 * 60 * 1000), // 45분 전
      });

      // When: 만료된 주문들 조회
      const staleOrders = await orderRepository.findStalePendingOrders(20, 100);

      // Then: 가장 오래된 순서로 정렬되어야 함
      expect(staleOrders).toHaveLength(3);
      expect(staleOrders[0].id).toBe(order1.id); // 1시간 전 (가장 오래됨)
      expect(staleOrders[1].id).toBe(order3.id); // 45분 전
      expect(staleOrders[2].id).toBe(order2.id); // 30분 전
    });

    it("타임존이 다른 환경에서도 올바르게 작동해야 함", async () => {
      const now = new Date();

      // Given: UTC 시간으로 만료된 주문 생성
      const utcTime = new Date(now.getTime() - 30 * 60 * 1000);
      const staleOrder = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-123",
        status: OrderStatus.PENDING,
        createdAt: utcTime,
      });

      // When: 현재 시간 기준으로 만료 조회
      const staleOrders = await orderRepository.findStalePendingOrders(20, 100);

      // Then: 시간 계산이 정확히 이루어져야 함
      expect(staleOrders).toHaveLength(1);
      expect(staleOrders[0].id).toBe(staleOrder.id);
    });

    it("경계값 테스트 - 정확히 타임아웃 시간에 생성된 주문", async () => {
      const now = new Date();
      const timeoutMinutes = 20;

      // Given: 정확히 20분 전에 생성된 주문
      const exactTimeoutOrder = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-123",
          status: OrderStatus.PENDING,
          createdAt: new Date(now.getTime() - timeoutMinutes * 60 * 1000),
        }
      );

      // 19분 59초 전에 생성된 주문 (아직 유효)
      await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-456",
        status: OrderStatus.PENDING,
        createdAt: new Date(now.getTime() - (timeoutMinutes * 60 - 1) * 1000),
      });

      // When: 20분 타임아웃으로 조회
      const staleOrders = await orderRepository.findStalePendingOrders(
        timeoutMinutes,
        100
      );

      // Then: 정확히 20분 전 주문은 만료로 처리되어야 함
      expect(staleOrders).toHaveLength(1);
      expect(staleOrders[0].id).toBe(exactTimeoutOrder.id);
    });
  });

  describe("findFailedOrders - Status-based Query with Relations", () => {
    it("FAILED 상태의 주문들만 조회하고 OrderItems를 포함해야 함", async () => {
      // Given: 다양한 상태의 주문들과 주문 아이템들
      const failedOrder1 = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-123",
          status: OrderStatus.FAILED,
          failedReason: "결제 실패",
        }
      );

      const failedOrder2 = await OrderFactory.createAndSave(
        orderOrmRepository,
        {
          userId: "user-456",
          status: OrderStatus.FAILED,
          failedReason: "재고 부족",
        }
      );

      // SUCCESS 주문 (조회되면 안됨)
      await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-789",
        status: OrderStatus.SUCCESS,
      });

      // 주문 아이템들 생성
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: failedOrder1.id,
        productId: "product-1",
        quantity: 2,
        unitPrice: 1000,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: failedOrder2.id,
        productId: "product-2",
        quantity: 1,
        unitPrice: 2000,
      });

      // When: 실패한 주문들 조회
      const failedOrders = await orderRepository.findFailedOrders(100);

      // Then: FAILED 상태의 주문들만 반환되어야 함
      expect(failedOrders).toHaveLength(2);
      expect(
        failedOrders.every((order) => order.status === OrderStatus.FAILED)
      ).toBe(true);

      // OrderItems가 포함되어 있는지 확인 (Relations 테스트)
      const orderWithItems = failedOrders.find(
        (order) => order.id === failedOrder1.id
      );
      expect(orderWithItems.orderItems).toHaveLength(1);
      expect(orderWithItems.orderItems[0].productId).toBe("product-1");
    });

    it("updatedAt 기준 오름차순 정렬이 올바르게 작동해야 함", async () => {
      const now = new Date();

      // Given: 다른 수정 시간을 가진 실패 주문들
      const order1 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-1",
        status: OrderStatus.FAILED,
        updatedAt: new Date(now.getTime() - 60 * 60 * 1000), // 1시간 전 수정
      });

      const order2 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-2",
        status: OrderStatus.FAILED,
        updatedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30분 전 수정
      });

      // When: 실패한 주문들 조회
      const failedOrders = await orderRepository.findFailedOrders(100);

      // Then: 가장 오래 전에 수정된 순서로 정렬되어야 함
      expect(failedOrders).toHaveLength(2);
      expect(failedOrders[0].id).toBe(order1.id); // 더 오래 전에 수정됨
      expect(failedOrders[1].id).toBe(order2.id);
    });

    it("limit 파라미터가 올바르게 작동해야 함", async () => {
      // Given: 5개의 실패한 주문들
      for (let i = 0; i < 5; i++) {
        await OrderFactory.createAndSave(orderOrmRepository, {
          userId: `user-${i}`,
          status: OrderStatus.FAILED,
        });
      }

      // When: limit 3으로 조회
      const failedOrders = await orderRepository.findFailedOrders(3);

      // Then: 3개만 반환되어야 함
      expect(failedOrders).toHaveLength(3);
    });
  });

  describe("findByUserId - User-specific Query with Relations", () => {
    it("특정 사용자의 주문들을 최신순으로 조회하고 OrderItems를 포함해야 함", async () => {
      const targetUserId = "user-123";
      const otherUserId = "user-456";

      // Given: 여러 사용자의 주문들
      const userOrder1 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: targetUserId,
        status: OrderStatus.SUCCESS,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1시간 전
      });

      const userOrder2 = await OrderFactory.createAndSave(orderOrmRepository, {
        userId: targetUserId,
        status: OrderStatus.PENDING,
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30분 전 (더 최신)
      });

      // 다른 사용자의 주문 (조회되면 안됨)
      await OrderFactory.createAndSave(orderOrmRepository, {
        userId: otherUserId,
        status: OrderStatus.SUCCESS,
      });

      // 주문 아이템들 생성
      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: userOrder1.id,
        productId: "product-1",
        quantity: 2,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: userOrder2.id,
        productId: "product-2",
        quantity: 1,
      });

      // When: 특정 사용자의 주문들 조회
      const userOrders = await orderRepository.findByUserId(targetUserId);

      // Then: 해당 사용자의 주문들만 최신순으로 반환되어야 함
      expect(userOrders).toHaveLength(2);
      expect(userOrders.every((order) => order.userId === targetUserId)).toBe(
        true
      );

      // 최신순 정렬 확인 (createdAt DESC)
      expect(userOrders[0].id).toBe(userOrder2.id); // 더 최신
      expect(userOrders[1].id).toBe(userOrder1.id); // 더 오래됨

      // OrderItems 포함 확인
      expect(userOrders[0].orderItems).toHaveLength(1);
      expect(userOrders[1].orderItems).toHaveLength(1);
    });

    it("주문이 없는 사용자에 대해 빈 배열을 반환해야 함", async () => {
      // Given: 다른 사용자의 주문만 존재
      await OrderFactory.createAndSave(orderOrmRepository, {
        userId: "user-456",
        status: OrderStatus.SUCCESS,
      });

      // When: 주문이 없는 사용자로 조회
      const userOrders = await orderRepository.findByUserId("user-123");

      // Then: 빈 배열 반환
      expect(userOrders).toHaveLength(0);
    });

    it("여러 OrderItems를 가진 주문이 올바르게 매핑되어야 함", async () => {
      const userId = "user-123";

      // Given: 여러 아이템을 가진 주문
      const order = await OrderFactory.createAndSave(orderOrmRepository, {
        userId,
        status: OrderStatus.SUCCESS,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: order.id,
        productId: "product-1",
        quantity: 2,
        unitPrice: 1000,
      });

      await OrderItemFactory.createAndSave(orderItemOrmRepository, {
        orderId: order.id,
        productId: "product-2",
        quantity: 1,
        unitPrice: 2000,
      });

      // When: 사용자 주문 조회
      const userOrders = await orderRepository.findByUserId(userId);

      // Then: 모든 OrderItems가 포함되어야 함
      expect(userOrders).toHaveLength(1);
      expect(userOrders[0].orderItems).toHaveLength(2);

      const orderItems = userOrders[0].orderItems;
      expect(orderItems.some((item) => item.productId === "product-1")).toBe(
        true
      );
      expect(orderItems.some((item) => item.productId === "product-2")).toBe(
        true
      );
    });
  });

  describe("Performance Tests", () => {
    it("대량의 주문 데이터에서 쿼리 성능이 적절해야 함", async () => {
      const batchSize = 50;
      const totalOrders = 500;
      const targetUserId = "performance-test-user";

      // Given: 대량의 주문 데이터 생성
      for (let i = 0; i < totalOrders / batchSize; i++) {
        const orders = [];
        for (let j = 0; j < batchSize; j++) {
          const orderNum = i * batchSize + j + 1;
          orders.push(
            OrderFactory.create({
              userId: orderNum % 10 === 0 ? targetUserId : `user-${orderNum}`,
              status:
                orderNum % 3 === 0 ? OrderStatus.FAILED : OrderStatus.SUCCESS,
              createdAt: new Date(Date.now() - orderNum * 60 * 1000), // 분 단위로 시간차
            })
          );
        }
        await orderOrmRepository.save(orders);
      }

      // When: 성능 측정
      const startTime = Date.now();

      // 실패한 주문 조회
      const failedOrders = await orderRepository.findFailedOrders(50);

      // 특정 사용자 주문 조회
      const userOrders = await orderRepository.findByUserId(targetUserId);

      // 만료된 주문 조회
      const staleOrders = await orderRepository.findStalePendingOrders(60, 50);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Then: 성능 및 정확성 검증
      expect(failedOrders.length).toBeGreaterThan(0);
      expect(userOrders.length).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(2000); // 2초 이내

      console.log(`Complex queries on 500 orders took ${totalTime}ms`);
      console.log(
        `Failed orders: ${failedOrders.length}, User orders: ${userOrders.length}, Stale orders: ${staleOrders.length}`
      );
    });
  });
});
