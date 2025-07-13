# 시퀀스 다이어그램

## 중요도 나열

| 시나리오 번호 | 시나리오 설명                        | 중요도 | 이유                                                               |
| ------------- | ------------------------------------ | ------ | ------------------------------------------------------------------ |
| 4-1           | **정상 결제 흐름**                   | **상** | 시스템의 핵심 비즈니스 플로우. 모든 요소(잔액, 쿠폰, 재고 등) 연계 |
| 4-5           | **결제 중 오류 → 보류 처리 및 복구** | **상** | 예외 발생 시 신뢰 보장 핵심. 원자성·복구 로직 검증 필요            |
| 6-1           | **중복 결제 요청 방지**              | **상** | 결제 이중 처리 방지 필수. 장애 발생 가능성 높음                    |
| 1-1           | 잔액 충전 성공 및 잔액 조회          | 중     | 필수 기능이지만 상대적으로 단순. 예외 흐름 없음                    |
| 1-2           | 잔액 충전 실패 (단위, 금액 초과 등)  | 중     | UX적으로 중요. 서버 단에서 검증 처리 필요                          |
| 3-1           | 쿠폰 발급 성공                       | 중     | 선착순 조건 시 유저 경험 영향. 하지만 구조는 단순                  |
| 3-2           | 쿠폰 발급 실패 (소진, 중복 등)       | 중     | 빈도 높은 예외. 정책 상 복잡성 있음                                |
| 4-2           | 주문 실패 - 잔액 부족                | 중     | 자주 발생 가능. 단순하지만 빠른 응답 필요                          |
| 4-3           | 주문 실패 - 재고 부족                | 중     | 인기 상품일수록 빈도 높음. 동시성 주의 필요                        |
| 4-4           | 주문 실패 - 쿠폰 오류                | 중     | 쿠폰 조건이 다양할 경우 정책 오류 가능성 있음                      |
| 5-1           | 보류 주문 → 1분 후 자동 복구         | 중     | 백엔드 로직 중요. 사용자 불신 방지 포인트                          |
| 2-1           | 전체 상품 목록 조회                  | 하     | 단순 조회. 실패해도 장애 영향 적음                                 |
| 2-2           | 단일 상품 상세 조회                  | 하     | 동일. 404 외 특별한 로직 없음                                      |
| 7-1           | 인기 상품 조회                       | 하     | 비핵심 기능. 마케팅 성격 강함                                      |

## 전제 사항

- JWT 토큰 사용

## 시나리오 별 시퀀스 다이어그램

<details>

<summary>
1. 잔액 충전 & 조회 흐름
</summary>

## 1. 잔액 충전 & 조회 흐름

### 1-1. [성공] 충전 요청 성공 → 잔액 반영 → 조회

```mermaid
sequenceDiagram
participant Client
participant API_Server
participant AuthService
participant WalletService
participant Database

    Client->>API_Server: POST /api/points/charge { amount: 10000 }
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId


    API_Server->>WalletService: chargePoints(userId, amount)
    WalletService->>Database: 잔액 업데이트
    Database-->>WalletService: 변경된 잔액 반환
    WalletService-->>API_Server: 성공, 업데이트된 잔액

    API_Server-->>Client: 200 OK { newBalance: 20000 }
```

---

### 1-2. [실패] 충전 실패 (단위 미만, 한도 초과 등)

```mermaid
sequenceDiagram
participant Client
participant API_Server
participant AuthService
participant WalletService

    Client->>API_Server: POST /api/points/charge { amount: 123 }
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>WalletService: chargePoints(userId, amount)

    alt 충전 금액 단위 오류
        WalletService-->>API_Server: 실패 (10원 단위 아님)
    else 최소 금액 미만
        WalletService-->>API_Server: 실패 (1,000원 이상 필요)
    else 1회 한도 초과
        WalletService-->>API_Server: 실패 (1회 최대 100,000원)
    else 총 보유 한도 초과
        WalletService-->>API_Server: 실패 (총 보유 한도 초과)
    end

    API_Server-->>Client: 400 Bad Request { message: "유효하지 않은 충전 금액입니다." }
```

</details>

<details>

<summary>2. 상품 목록 및 단일 조회</summary>

## 2. 상품 목록 및 단일 조회

### 2-1. [성공] 전체 상품 조회

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant ProductService
    participant Database

    Client->>API_Server: GET /api/products
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>ProductService: getAllProducts()
    ProductService->>Database: SELECT * FROM products
    Database-->>ProductService: 전체 상품 목록

    ProductService-->>API_Server: 상품 리스트 반환
    API_Server-->>Client: 200 OK { products: [...] }

```

### 2-2. [성공/실패] 단일 상품 상세 조회

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant ProductService
    participant Database

    Client->>API_Server: GET /api/products/:id
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>ProductService: getProductById(id)
    ProductService->>Database: SELECT * FROM products WHERE id = :id

    alt 상품 존재
        Database-->>ProductService: 상품 정보
        ProductService-->>API_Server: 상품 정보
        API_Server-->>Client: 200 OK { product: {...} }
    else 상품 없음
        Database-->>ProductService: null
        ProductService-->>API_Server: 상품 없음 오류
        API_Server-->>Client: 404 Not Found { message: "상품을 찾을 수 없습니다." }
    end
```

</details>

<details>

<summary>3. 쿠폰 발급 및 조회</summary>

## 3. 쿠폰 발급 및 조회

### 3-1. [성공] 선착순 쿠폰 발급 → 보유 쿠폰 조회

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant CouponService
    participant Database

    Client->>API_Server: POST /api/coupons { couponCode: "EVENT2025" }
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>CouponService: issueCoupon(userId, couponCode)
    CouponService->>Database: check availability and duplication
    Database-->>CouponService: available

    CouponService->>Database: insert coupon record
    Database-->>CouponService: 발급 완료

    CouponService-->>API_Server: 발급 성공
    API_Server-->>Client: 200 OK { message: "쿠폰이 발급되었습니다." }
```

### 3-2. [실패] 발급 실패

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant CouponService
    participant Database

    Client->>API_Server: POST /api/coupons { couponCode: "EVENT2025" }
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>CouponService: issueCoupon(userId, couponCode)
    CouponService->>Database: check availability and duplication

    alt 이미 발급된 쿠폰
        Database-->>CouponService: already issued
        CouponService-->>API_Server: 실패 - 중복 발급
        API_Server-->>Client: 409 Conflict { message: "이미 발급받은 쿠폰입니다." }
    else 수량 소진
        Database-->>CouponService: out of stock
        CouponService-->>API_Server: 실패 - 수량 초과
        API_Server-->>Client: 410 Gone { message: "쿠폰 수량이 모두 소진되었습니다." }
    else 조건 불충족
        Database-->>CouponService: not eligible
        CouponService-->>API_Server: 실패 - 발급 조건 미충족
        API_Server-->>Client: 403 Forbidden { message: "발급 대상이 아닙니다." }
    end
```

- 수량 소진
- 이미 발급받은 쿠폰
- 발급 조건 미달

</details>

<details>

<summary>4. 결제 프로세스 (전체 흐름)</summary>

## 4. 결제 프로세스 (전체 흐름)

### 4-1. [성공] 정상 주문 → 재고/쿠폰/잔액 확보 → 결제 완료

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
    OrderService->>ProductService: reserveStock(items)
    ProductService-->>OrderService: 재고 확보 성공

    %% 잔액 확인 및 차감
    OrderService->>WalletService: deductBalance(userId, finalAmount)
    WalletService->>Database: update balance
    Database-->>WalletService: OK

    %% 재고 차감
    OrderService->>ProductService: confirmStock(items)
    ProductService->>Database: update stock
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

쿠폰 → 잔액 순 차감
주문 상태: 결제 완료

### 4-2. [실패] 잔액 부족

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
    OrderService->>ProductService: reserveStock(items)
    ProductService-->>OrderService: 재고 확보 OK

    %% 2. 잔액 확인
    OrderService->>WalletService: checkBalance(userId, totalAmount)

    alt 잔액 부족
        WalletService-->>OrderService: insufficient balance

        %% 3. 확보한 재고 복구
        OrderService->>ProductService: releaseStock(items)
        ProductService-->>OrderService: 재고 복원 완료

        %% 4. 주문 상태 업데이트 (실패 처리)
        OrderService->>Database: update order { status: "failed", reason: "INSUFFICIENT_BALANCE" }

        %% 5. 클라이언트에 실패 응답
        OrderService-->>API_Server: 잔액 부족
        API_Server-->>Client: 402 Payment Required { message: "잔액이 부족합니다." }
    end

```

결제 불가 → 주문 실패
재고/쿠폰 확보 안 됨

### 4-3. [실패] 재고 부족

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

    OrderService->>ProductService: reserveStock(items)

    alt 재고 부족
        ProductService-->>OrderService: stock unavailable
        OrderService-->>API_Server: 재고 부족
        API_Server-->>Client: 409 Conflict { message: "일부 상품의 재고가 부족합니다." }

        %% 주문 상태 업데이트 (실패 처리)
        OrderService->>Database: update order { status: "failed", reason: "INSUFFICIENT_STOCK" }
    end
```

잔액 충분 → 재고 확보 실패
주문 실패

### 4-4. [실패] 쿠폰 무효

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
    OrderService->>ProductService: reserveStock(items)
    ProductService-->>OrderService: 재고 확보 OK

    %% 쿠폰 검사
    OrderService->>CouponService: validateCoupon(userId, couponId)

    alt 쿠폰 무효
        CouponService-->>OrderService: invalid or expired
        OrderService->>ProductService: releaseStock(items)
        ProductService-->>OrderService: 재고 복구 완료

        %% 주문 상태 업데이트 (실패 처리)
        OrderService->>Database: update order { status: "failed", reason: "INVALID_COUPON" }

        OrderService-->>API_Server: 쿠폰 오류
        API_Server-->>Client: 400 Bad Request { message: "쿠폰이 유효하지 않습니다." }
    end

```

쿠폰 만료, 조건 미충족 등 → 주문 실패

### 4-5. [실패] 결제 중 시스템 오류

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

    %% 주문 저장 중 장애 발생
    OrderService->>Database: update order { status: "success" }
    Database-->>OrderService: 오류 (예: DB timeout)

    %% 보류 처리
    OrderService-->>API_Server: 주문 보류 처리
    API_Server-->>Client: 202 Accepted { message: "결제 처리 중 오류 발생, 자동 복구 예정" }

    %% 보류 처리
    OrderService->>OrderFallbackService: 보류 처리 요청
    OrderFallbackService->>임시 저장소: update order { status: "pending" }
    OrderFallbackService->>Database: update order { status: "pending" } (반복 요청)


    Note over OrderService, Database: 1분 내 잔액, 재고, 쿠폰 자동 복원 로직 실행
```

결제 처리 중 네트워크/DB 오류
주문 상태: 보류
이후 1분 내 잔액/재고/쿠폰 복구 로직 실행

</details>

<details>

<summary>5. 보류 주문 → 자동 복구 흐름</summary>

## 5. 보류 주문 → 자동 복구 흐름

### 5-1. 주문 보류 → 타이머 만료 → 자동 복구

```mermaid
sequenceDiagram
    participant RecoveryScheduler
    participant OrderService
    participant WalletService
    participant ProductService
    participant CouponService
    participant Database

    %% 스케줄러가 보류 상태 주문 감지
    RecoveryScheduler->>OrderService: getPendingOrders()
    OrderService->>Database: SELECT * FROM orders WHERE status = '보류'
    Database-->>OrderService: 보류 주문 목록

    loop 각 보류 주문
        %% 잔액 복구
        OrderService->>WalletService: restoreBalance(userId, amount)
        WalletService->>Database: update balance
        Database-->>WalletService: OK

        %% 재고 복구
        OrderService->>ProductService: releaseStock(items)
        ProductService->>Database: update stock
        Database-->>ProductService: OK

        %% 쿠폰 복구
        OrderService->>CouponService: restoreCoupon(userId, couponId)
        CouponService->>Database: update coupon status
        Database-->>CouponService: OK

        %% 주문 상태 업데이트
        OrderService->>Database: update order { status: "canceled", reason: "system failure" }
    end
```

잔액 복원
재고 되돌림
쿠폰 복구

</details>

<details>

<summary>6. 중복 결제 요청 방지</summary>

## 6. 중복 결제 요청 방지

### 6-1. 같은 주문 재요청 시 중복 방지 응답

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant OrderService
    participant Database

    Client->>API_Server: POST /api/orders (요청 ID: abc123)
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>OrderService: createOrder(userId, 요청 ID)

    OrderService->>Database: check if order with 요청 ID exists
    alt 존재함
        Database-->>OrderService: 주문 이미 있음
        OrderService-->>API_Server: 중복 요청
        API_Server-->>Client: 409 Conflict { message: "중복 요청입니다." }
    else 없음
        Database-->>OrderService: 신규 요청
        OrderService->>Database: insert new order
        Database-->>OrderService: OK
        OrderService-->>API_Server: 주문 성공
        API_Server-->>Client: 200 OK
    end
```

요청 ID or 타임스탬프 기반 비교
응답: “이미 처리 중입니다”

</details>

<details>

<summary>7. 인기 상품 조회</summary>

## 7. 인기 상품 조회

### 7-1. [정상] 최근 3일 기준 인기 상품 조회

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant ProductService
    participant Database

    Client->>API_Server: GET /api/products/popular
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>ProductService: getPopularProducts()
    ProductService->>Database: SELECT product_id, SUM(qty) FROM orders WHERE created_at >= NOW() - 3일 GROUP BY product_id ORDER BY SUM(qty) DESC LIMIT 5
    Database-->>ProductService: 인기 상품 5개

    ProductService-->>API_Server: 상품 목록
    API_Server-->>Client: 200 OK { products: [...] }
```

단순 조회로, 실패 시나리오는 생략 가능

</details>
