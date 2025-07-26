import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource, Repository } from "typeorm";
import { TestContainersHelper } from "../testcontainers-helper";
import { OrderFactory } from "../../src/order/infrastructure/persistence/factories/order.factory";
import { OrderItemFactory } from "../../src/order/infrastructure/persistence/factories/order-item.factory";
import {
  OrderTypeOrmEntity,
  OrderStatus,
} from "../../src/order/infrastructure/persistence/orm/order.typeorm.entity";
import { OrderItemTypeOrmEntity } from "../../src/order/infrastructure/persistence/orm/order-item.typeorm.entity";
import { ProductFactory } from "../../src/product/infrastructure/persistence/factories/product.factory";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { UserBalanceFactory } from "../../src/wallet/infrastructure/persistence/factories/user-balance.factory";
import { UserBalanceTypeOrmEntity } from "../../src/wallet/infrastructure/persistence/orm/user-balance.typeorm.entity";

describe("Order API E2E (with TestContainers)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orderRepository: Repository<OrderTypeOrmEntity>;
  let orderItemRepository: Repository<OrderItemTypeOrmEntity>;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let userBalanceRepository: Repository<UserBalanceTypeOrmEntity>;
  let testHelper: TestContainersHelper;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupWithMySQL();
    app = setup.app;
    dataSource = setup.dataSource;
    orderRepository = dataSource.getRepository(OrderTypeOrmEntity);
    orderItemRepository = dataSource.getRepository(OrderItemTypeOrmEntity);
    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    userBalanceRepository = dataSource.getRepository(UserBalanceTypeOrmEntity);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    // 각 테스트를 위한 기본 사용자 생성 (인증용)
    await testHelper.createTestUser(dataSource);
    // Factory counter 초기화
    OrderFactory.resetCounter();
    OrderItemFactory.resetCounter();
    ProductFactory.resetCounter();
    UserBalanceFactory.resetCounter();
  });

  describe("POST /api/orders", () => {
    it("정상적인 주문을 생성할 때 주문 생성 및 결제가 이루어져야 함", async () => {
      // Given: 주문에 필요한 상품과 사용자 잔액 준비
      const testProduct = await ProductFactory.createAndSave(
        productRepository,
        {
          id: "test-product-1",
          name: "테스트 상품",
          price: 10000,
          totalStock: 100,
          reservedStock: 0,
          isActive: true,
        }
      );

      await UserBalanceFactory.createAndSave(userBalanceRepository, {
        userId: "user-123",
        balance: 50000, // 충분한 잔액
      });

      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 주문 생성 요청
      const response = await request(app.getHttpServer())
        .post("/api/orders")
        .set(authHeaders)
        .send({
          items: [
            {
              productId: testProduct.id,
              quantity: 2,
            },
          ],
          idempotencyKey: "test-order-001",
        })
        .expect(201);

      // Then: 주문이 성공적으로 생성되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        userId: "user-123",
        totalAmount: 20000, // 10000 * 2
        finalAmount: 20000,
        status: "SUCCESS",
        idempotencyKey: "test-order-001",
      });
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0]).toMatchObject({
        productId: testProduct.id,
        quantity: 2,
        unitPrice: 10000,
        totalPrice: 20000,
      });
      expect(response.body.message).toBe("주문이 성공적으로 완료되었습니다");

      // DB에서 주문이 생성되었는지 확인
      const orders = await orderRepository.find();
      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe("SUCCESS");
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 주문 생성 시도
      const response = await request(app.getHttpServer())
        .post("/api/orders")
        .send({
          items: [
            {
              productId: "test-product",
              quantity: 1,
            },
          ],
        })
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });

  describe("GET /api/orders/:orderId", () => {
    it("특정 주문을 상세 조회할 때 올바른 주문 정보가 반환되어야 함", async () => {
      // Given: 테스트 주문 생성
      const testOrder = await OrderFactory.createAndSave(orderRepository, {
        id: "test-order-detail",
        userId: "user-123",
        totalPrice: 15000,
        discountPrice: 0,
        finalPrice: 15000,
        status: OrderStatus.SUCCESS,
        idempotencyKey: "test-order-detail-key",
      });

      const testOrderItem = await OrderItemFactory.createAndSave(
        orderItemRepository,
        {
          orderId: testOrder.id,
          productId: "test-product-1",
          quantity: 1,
          unitPrice: 15000,
          totalPrice: 15000,
        }
      );

      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 주문 상세 조회
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${testOrder.id}`)
        .set(authHeaders)
        .expect(200);

      // Then: 주문 정보가 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testOrder.id,
        userId: testOrder.userId,
        totalAmount: testOrder.totalPrice,
        finalAmount: testOrder.finalPrice,
        status: testOrder.status,
        idempotencyKey: testOrder.idempotencyKey,
      });
      expect(response.body.message).toBe("주문 정보를 조회했습니다");
    });

    it("존재하지 않는 주문을 조회할 때 404 에러가 발생해야 함", async () => {
      // Given: 인증 헤더 준비
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 존재하지 않는 주문 조회
      const response = await request(app.getHttpServer())
        .get("/api/orders/non-existent-order")
        .set(authHeaders)
        .expect(404);

      // Then: 주문을 찾을 수 없다는 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("주문을 찾을 수 없습니다");
    });
  });

  describe("GET /api/users/me/orders", () => {
    it("내 주문 목록을 조회할 때 올바른 목록이 반환되어야 함", async () => {
      // Given: 사용자의 주문들 생성
      const userId = "user-123";
      await OrderFactory.createManyAndSave(orderRepository, 3, {
        userId: userId,
      });

      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 내 주문 목록 조회
      const response = await request(app.getHttpServer())
        .get("/api/users/me/orders")
        .set(authHeaders)
        .expect(200);

      // Then: 내 주문 목록이 올바르게 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.message).toBe("주문 목록을 조회했습니다");

      // 각 주문이 올바른 구조를 가져야 함
      response.body.data.forEach((order: any) => {
        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("userId");
        expect(order).toHaveProperty("totalAmount");
        expect(order).toHaveProperty("finalAmount");
        expect(order).toHaveProperty("status");
        expect(order).toHaveProperty("createdAt");
        expect(order.userId).toBe(userId);
      });
    });

    it("주문이 없는 경우 조회할 때 빈 배열이 반환되어야 함", async () => {
      // Given: 주문이 없는 사용자
      const authHeaders = await testHelper.getAuthHeaders(app);

      // When: 내 주문 목록 조회
      const response = await request(app.getHttpServer())
        .get("/api/users/me/orders")
        .set(authHeaders)
        .expect(200);

      // Then: 빈 배열이 반환되어야 함
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it("토큰 없이 접근할 때 401 에러가 발생해야 함", async () => {
      // When: 토큰 없이 내 주문 목록 조회 시도
      const response = await request(app.getHttpServer())
        .get("/api/users/me/orders")
        .expect(401);

      // Then: 인증 에러 메시지가 반환되어야 함
      expect(response.body.message).toBe("토큰이 필요합니다");
    });
  });
});
