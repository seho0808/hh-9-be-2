# 결제 프로세스 (전체 흐름)

## 4-1. [성공] 정상 주문 → 재고/쿠폰/잔액 확보 → 결제 완료

엔드포인트: `POST /api/orders`

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant OrderService
    participant ProductService
    participant WalletService
    participant CouponService
    participant Database

    Client->>API_Server: POST /api/orders { items, couponId }
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>OrderService: createOrder(userId, items, couponId)
    OrderService->>Database: insert order

    %% 쿠폰 유효성 검증
    OrderService->>CouponService: validateCoupon(userId, couponId)
    CouponService-->>OrderService: 유효

    %% 재고 확보
    OrderService->>ProductService: reserveStock(items, userId)
    ProductService-->>OrderService: 재고 확보 성공 (reservationIds)

    %% 잔액 확인 및 차감
    OrderService->>WalletService: deductBalance(userId, finalAmount)
    WalletService->>Database: update balance
    Database-->>WalletService: OK

    %% 재고 차감
    OrderService->>ProductService: confirmStock(reservationIds)
    ProductService->>Database: update total_stock, reserved_stock
    Database-->>ProductService: OK

    %% 쿠폰 사용 처리
    OrderService->>CouponService: useCoupon(userId, couponId)
    CouponService->>Database: update coupon status
    Database-->>CouponService: OK

    %% 주문 정보 저장
    OrderService->>Database: update order { status: "success" }
    Database-->>OrderService: OK

    OrderService-->>API_Server: 주문 완료
    API_Server-->>Client: 200 OK { message: "결제가 완료되었습니다." }
```

---

## 4-2. [실패] 잔액 부족

엔드포인트: `POST /api/orders`

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant OrderService
    participant ProductService
    participant WalletService

    Client->>API_Server: POST /api/orders
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>OrderService: createOrder(userId, items)
    OrderService->>Database: insert order

    %% 1. 재고 확보
    OrderService->>ProductService: reserveStock(items, userId)
    ProductService-->>OrderService: 재고 확보 OK (reservationIds)

    %% 2. 잔액 확인
    OrderService->>WalletService: checkBalance(userId, totalAmount)

    alt 잔액 부족
        WalletService-->>OrderService: insufficient balance

        %% 3. 확보한 재고 복구
        OrderService->>ProductService: releaseStock(reservationIds)
        ProductService-->>OrderService: 재고 복원 완료

        %% 4. 주문 상태 업데이트 (실패 처리)
        OrderService->>Database: update order { status: "failed", reason: "INSUFFICIENT_BALANCE" }

        %% 5. 클라이언트에 실패 응답
        OrderService-->>API_Server: 잔액 부족
        API_Server-->>Client: 402 Payment Required { message: "잔액이 부족합니다." }
    end
```

---

## 4-3. [실패] 재고 부족

엔드포인트: `POST /api/orders`

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant OrderService
    participant ProductService

    Client->>API_Server: POST /api/orders
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>OrderService: createOrder(userId, items, couponId)
    OrderService->>Database: insert order

    OrderService->>ProductService: reserveStock(items, userId)

    alt 재고 부족
        ProductService-->>OrderService: stock unavailable
        OrderService-->>API_Server: 재고 부족
        API_Server-->>Client: 409 Conflict { message: "일부 상품의 재고가 부족합니다." }

        %% 주문 상태 업데이트 (실패 처리)
        OrderService->>Database: update order { status: "failed", reason: "INSUFFICIENT_STOCK" }
    end
```

### 재고 부족 시 동시성 해결방안

- **문제**: 인기 상품의 경우 동시에 여러 사용자가 주문을 시도할 수 있음
- **해결됨**: Reserve/Release 패턴으로 DB 필드 구현
  - `reserveStock(productId, quantity, userId)`: 재고 예약 → `reservationId` 반환
  - `confirmStock(reservationId)`: 재고 차감 확정
  - `releaseStock(reservationId)`: 재고 예약 해제
- **장점**: DB 레벨에서 동시성 제어, race condition 방지
- **TTL 자동 정리**: 30초 후 예약 만료 시 자동 `releaseStock()` 실행 + 5분 마다 배치 release (타 인스턴스 깨지는 것 대비)

---

## 4-4. [실패] 쿠폰 무효

엔드포인트: `POST /api/orders`

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant OrderService
    participant CouponService
    participant ProductService

    Client->>API_Server: POST /api/orders
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>OrderService: createOrder(userId, items, couponId)
    OrderService->>Database: insert order

    %% 재고 먼저 확보
    OrderService->>ProductService: reserveStock(items, userId)
    ProductService-->>OrderService: 재고 확보 OK (reservationIds)

    %% 쿠폰 검사
    OrderService->>CouponService: validateCoupon(userId, couponId)

    alt 쿠폰 무효
        CouponService-->>OrderService: invalid or expired
        OrderService->>ProductService: releaseStock(reservationIds)
        ProductService-->>OrderService: 재고 복구 완료

        %% 주문 상태 업데이트 (실패 처리)
        OrderService->>Database: update order { status: "failed", reason: "INVALID_COUPON" }

        OrderService-->>API_Server: 쿠폰 오류
        API_Server-->>Client: 400 Bad Request { message: "쿠폰이 유효하지 않습니다." }
    end
```

---

## 4-5. [실패] 결제 중 시스템 오류

엔드포인트: `POST /api/orders`

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant OrderService
    participant WalletService
    participant ProductService
    participant CouponService
    participant Database

    Client->>API_Server: POST /api/orders
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>OrderService: createOrder(userId, items, couponId)

    OrderService->>Database: insert order

    OrderService->>CouponService: validateCoupon()
    CouponService-->>OrderService: OK

    OrderService->>ProductService: reserveStock()
    ProductService-->>OrderService: OK

    OrderService->>WalletService: deductBalance()
    WalletService->>Database: update balance
    Database-->>WalletService: OK

    %% 결제 처리 중 통신 오류 발생
    WalletService-->>OrderService: 오류 (예: 결제 처리 중 통신 오류)

    %% 보류 처리
    OrderService-->>API_Server: 주문 보류 처리
    API_Server-->>Client: 202 Accepted { message: "결제 처리 중 오류 발생, 자동 복구 예정" }


    Note over OrderService, Database: 1분 내 잔액, 재고, 쿠폰 자동 복원 로직 실행
```
