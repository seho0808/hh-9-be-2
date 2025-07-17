import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { TestHelper } from "./test-helper";

describe("사용자 구매 여정 E2E", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestHelper.createTestApp();
  });

  afterAll(async () => {
    await TestHelper.closeTestApp();
  });

  describe("새 사용자 온보딩 → 첫 구매 여정", () => {
    it("회원가입부터 첫 주문까지 완전한 여정", async () => {
      // 1. 회원가입
      const registerDto = {
        email: "journey-user@example.com",
        password: "password123",
        name: "Journey User",
      };

      const registerResponse = await request(app.getHttpServer())
        .post("/api/users")
        .send(registerDto)
        .expect(201);

      expect(registerResponse.body.data.email).toBe("journey-user@example.com");

      // 2. 로그인
      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: "journey-user@example.com",
          password: "password123",
        })
        .expect(200);

      const token = loginResponse.body.data.accessToken;
      const authHeaders = { Authorization: `Bearer ${token}` };

      // 3. 프로필 확인
      const profileResponse = await request(app.getHttpServer())
        .get("/api/users/me")
        .set(authHeaders)
        .expect(200);

      expect(profileResponse.body.data.email).toBe("journey-user@example.com");

      // 4. 초기 잔액 확인 (0원일 것)
      const initialBalanceResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      const initialBalance = initialBalanceResponse.body.data.balance;
      expect(initialBalance).toBeGreaterThanOrEqual(0);

      // 5. 잔액 충전 (첫 충전)
      const chargeResponse = await request(app.getHttpServer())
        .post("/api/users/me/points/charges")
        .set(authHeaders)
        .send({ amount: 50000 })
        .expect(200);

      expect(chargeResponse.body.data.newBalance).toBe(initialBalance + 50000);

      // 6. 상품 둘러보기
      const productsResponse = await request(app.getHttpServer())
        .get("/api/products")
        .expect(200);

      expect(productsResponse.body.data.items.length).toBeGreaterThan(0);
      const product = productsResponse.body.data.items[0];

      // 7. 인기 상품도 확인
      const popularResponse = await request(app.getHttpServer())
        .get("/api/products/popular")
        .expect(200);

      expect(popularResponse.body.data.length).toBeGreaterThan(0);

      // 8. 상품 상세 확인
      const productDetailResponse = await request(app.getHttpServer())
        .get(`/api/products/${product.id}`)
        .expect(200);

      expect(productDetailResponse.body.data.name).toBe(product.name);

      // 9. 쿠폰 확인 및 발급
      const couponsResponse = await request(app.getHttpServer())
        .get("/api/coupons?active=true")
        .expect(200);

      let couponId = null;
      if (couponsResponse.body.data.length > 0) {
        const activeCoupon = couponsResponse.body.data[0];
        couponId = activeCoupon.id;

        const claimResponse = await request(app.getHttpServer())
          .post(`/api/coupons/${activeCoupon.id}/claims`)
          .set(authHeaders)
          .expect(200);

        expect(claimResponse.body.data.status).toBe("ACTIVE");
      }

      // 10. 첫 주문 생성
      const orderDto = {
        items: [
          {
            productId: product.id,
            quantity: 1,
            price: product.price,
          },
        ],
        ...(couponId && { couponId }),
      };

      const orderResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .set(authHeaders)
        .send(orderDto)
        .expect(200);

      expect(orderResponse.body.data.status).toBe("SUCCESS");
      const orderId = orderResponse.body.data.orderId;

      // 11. 주문 확인
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set(authHeaders)
        .expect(200);

      expect(orderDetailResponse.body.data.id).toBe(orderId);

      // 12. 주문 후 잔액 확인
      const finalBalanceResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      const finalBalance = finalBalanceResponse.body.data.balance;
      expect(finalBalance).toBeLessThan(initialBalance + 50000); // 구매했으므로 잔액 감소

      // 13. 거래 내역 확인
      const transactionsResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/transactions")
        .set(authHeaders)
        .expect(200);

      expect(transactionsResponse.body.data.items.length).toBeGreaterThan(0);
      // 충전과 사용 내역이 모두 있어야 함
      const transactions = transactionsResponse.body.data.items;
      const hasCharge = transactions.some((t: any) => t.type === "CHARGE");
      const hasDeduct = transactions.some((t: any) => t.type === "DEDUCT");
      expect(hasCharge).toBe(true);
      expect(hasDeduct).toBe(true);

      // 14. 최종 - 사용자 주문 내역 확인
      const userOrdersResponse = await request(app.getHttpServer())
        .get("/api/users/me/orders")
        .set(authHeaders)
        .expect(200);

      expect(userOrdersResponse.body.data.items.length).toBeGreaterThan(0);
      const userOrder = userOrdersResponse.body.data.items.find(
        (order: any) => order.id === orderId
      );
      expect(userOrder).toBeDefined();

      console.log("Complete User Journey Success");
      console.log(`- 회원가입: ${registerResponse.body.data.email}`);
      console.log(`- 충전 금액: 50,000원`);
      console.log(`- 주문 ID: ${orderId}`);
      console.log(`- 최종 잔액: ${finalBalance}원`);
    });
  });
});
