import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { TestHelper } from "./test-helper";

describe("쇼핑 시나리오 E2E", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestHelper.createTestApp();
  });

  afterAll(async () => {
    await TestHelper.closeTestApp();
  });

  describe("기존 사용자 쇼핑 시나리오", () => {
    it("쿠폰 헌팅 → 할인 쇼핑 시나리오", async () => {
      // 기존 사용자로 로그인
      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "password123",
        })
        .expect(200);

      const authHeaders = {
        Authorization: `Bearer ${loginResponse.body.data.accessToken}`,
      };

      // 1. 현재 잔액 확인
      const balanceResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      const currentBalance = balanceResponse.body.data.balance;

      // 2. 잔액이 부족하면 충전
      if (currentBalance < 20000) {
        await request(app.getHttpServer())
          .post("/api/users/me/points/charges")
          .set(authHeaders)
          .send({ amount: 30000 })
          .expect(200);
      }

      // 3. 활성 쿠폰들 확인
      const activeCouponsResponse = await request(app.getHttpServer())
        .get("/api/coupons?active=true")
        .expect(200);

      expect(activeCouponsResponse.body.data.length).toBeGreaterThan(0);

      // 4. 사용 가능한 쿠폰들 모두 발급받기
      const claimedCoupons = [];
      for (const coupon of activeCouponsResponse.body.data.slice(0, 2)) {
        // 최대 2개만
        const claimResponse = await request(app.getHttpServer())
          .post(`/api/coupons/${coupon.id}/claims`)
          .set(authHeaders)
          .expect(200);

        if (claimResponse.body.success) {
          claimedCoupons.push(coupon);
        }
      }

      // 5. 내 쿠폰 목록 확인
      const myCouponsResponse = await request(app.getHttpServer())
        .get("/api/users/me/coupons")
        .set(authHeaders)
        .expect(200);

      expect(myCouponsResponse.body.data.length).toBeGreaterThan(0);

      // 6. 인기 상품 먼저 체크
      const popularProductsResponse = await request(app.getHttpServer())
        .get("/api/products/popular")
        .expect(200);

      const popularProduct = popularProductsResponse.body.data[0];

      // 7. 일반 상품도 둘러보기
      const productsResponse = await request(app.getHttpServer())
        .get("/api/products")
        .expect(200);

      const regularProduct = productsResponse.body.data.items[1]; // 두 번째 상품 선택

      // 8. 첫 번째 주문 - 쿠폰 적용
      if (claimedCoupons.length > 0) {
        const orderWithCouponDto = {
          items: [
            {
              productId: popularProduct.id,
              quantity: 1,
              price: popularProduct.price || 10000,
            },
          ],
          couponId: claimedCoupons[0].id,
        };

        const couponOrderResponse = await request(app.getHttpServer())
          .post("/api/orders")
          .set(authHeaders)
          .send(orderWithCouponDto)
          .expect(200);

        expect(couponOrderResponse.body.data.status).toBe("SUCCESS");
        expect(couponOrderResponse.body.data).toHaveProperty("discountAmount");
        expect(couponOrderResponse.body.data.finalAmount).toBeLessThan(
          couponOrderResponse.body.data.totalAmount
        );

        console.log(
          `🎫 쿠폰 적용 주문 성공! 할인액: ${couponOrderResponse.body.data.discountAmount || 0}원`
        );
      }

      // 9. 두 번째 주문 - 여러 상품 주문
      const multiItemOrderDto = {
        items: [
          {
            productId: popularProduct.id,
            quantity: 1,
            price: popularProduct.price || 10000,
          },
          {
            productId: regularProduct.id,
            quantity: 2,
            price: regularProduct.price || 5000,
          },
        ],
      };

      const multiOrderResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .set(authHeaders)
        .send(multiItemOrderDto)
        .expect(200);

      expect(multiOrderResponse.body.data.items.length).toBe(2);
      expect(multiOrderResponse.body.data.status).toBe("SUCCESS");

      // 10. 최종 잔액 및 거래 내역 확인
      const finalBalanceResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      const finalBalance = finalBalanceResponse.body.data.balance;

      const transactionsResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/transactions")
        .set(authHeaders)
        .expect(200);

      expect(transactionsResponse.body.data.items.length).toBeGreaterThan(0);

      // 11. 내 주문 내역 확인
      const myOrdersResponse = await request(app.getHttpServer())
        .get("/api/users/me/orders")
        .set(authHeaders)
        .expect(200);

      expect(myOrdersResponse.body.data.items.length).toBeGreaterThanOrEqual(2);

      console.log("🛒 쿠폰 헌팅 쇼핑 시나리오 완료!");
      console.log(`- 발급받은 쿠폰: ${claimedCoupons.length}개`);
      console.log(
        `- 완료된 주문: ${myOrdersResponse.body.data.items.length}개`
      );
      console.log(`- 현재 잔액: ${finalBalance}원`);
    });

    it("단골 고객 대량 구매 시나리오", async () => {
      // 기존 사용자로 로그인
      const authHeaders = TestHelper.getAuthHeaders();

      // 1. 잔액 충전 (대량 구매를 위해)
      const chargeResponse = await request(app.getHttpServer())
        .post("/api/users/me/points/charges")
        .set(authHeaders)
        .send({ amount: 100000 })
        .expect(200);

      expect(chargeResponse.body.data.amount).toBe(100000);

      // 2. 전체 상품 카탈로그 확인
      const allProductsResponse = await request(app.getHttpServer())
        .get("/api/products")
        .expect(200);

      const products = allProductsResponse.body.data.items;
      expect(products.length).toBeGreaterThanOrEqual(3);

      // 3. 인기 상품들 확인
      const popularResponse = await request(app.getHttpServer())
        .get("/api/products/popular")
        .expect(200);

      // 4. 대량 주문 생성 (여러 상품, 높은 수량)
      const bulkOrderDto = {
        items: products.slice(0, 3).map((product: any, index: number) => ({
          productId: product.id,
          quantity: index + 2, // 2, 3, 4개씩
          price: product.price || 10000,
        })),
      };

      const bulkOrderResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .set(authHeaders)
        .send(bulkOrderDto)
        .expect(200);

      expect(bulkOrderResponse.body.data.status).toBe("SUCCESS");
      expect(bulkOrderResponse.body.data.items.length).toBe(3);

      const orderId = bulkOrderResponse.body.data.orderId;

      // 5. 주문 상세 확인
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set(authHeaders)
        .expect(200);

      expect(orderDetailResponse.body.data.items.length).toBe(3);

      // 6. 추가 주문 (연속 구매)
      const followUpOrderDto = {
        items: [
          {
            productId: products[0].id,
            quantity: 5,
            price: products[0].price || 10000,
          },
        ],
      };

      const followUpResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .set(authHeaders)
        .send(followUpOrderDto)
        .expect(200);

      expect(followUpResponse.body.data.status).toBe("SUCCESS");

      // 7. 최종 상태 확인
      const finalOrdersResponse = await request(app.getHttpServer())
        .get("/api/users/me/orders")
        .set(authHeaders)
        .expect(200);

      const finalBalanceResponse = await request(app.getHttpServer())
        .get("/api/users/me/points/balance")
        .set(authHeaders)
        .expect(200);

      console.log("💎 단골 고객 대량 구매 완료!");
      console.log(
        `- 총 주문 건수: ${finalOrdersResponse.body.data.items.length}개`
      );
      console.log(`- 남은 잔액: ${finalBalanceResponse.body.data.balance}원`);
      console.log(`- 최근 주문 ID: ${followUpResponse.body.data.orderId}`);
    });
  });
});
