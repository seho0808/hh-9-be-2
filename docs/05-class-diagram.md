# 클래스 다이어그램

## 전체 시스템 클래스 다이어그램

```mermaid
classDiagram
    %% 엔티티 클래스
    class User {
        +String id
        +String email
        +String password
        +String name
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
        +getUserBalance() UserBalance
        +getUserCoupons() List~UserCoupon~
        +getOrders() List~Order~
    }

    class Product {
        +String id
        +String name
        +String description
        +Long price
        +Integer stock
        +Boolean isActive
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
        +reserveStock(quantity) Boolean
        +releaseStock(quantity) Boolean
        +confirmStock(quantity) Boolean
        +isAvailable(quantity) Boolean
    }

    class Order {
        +String id
        +String userId
        +Long totalAmount
        +Long discountAmount
        +Long finalAmount
        +OrderStatus status
        +String requestId
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
        +getOrderItems() List~OrderItem~
        +getUsedCoupon() UserCoupon
        +calculateTotal() Long
        +applyDiscount(coupon) Long
    }

    class OrderItem {
        +String id
        +String orderId
        +String productId
        +Integer quantity
        +Long unitPrice
        +Long totalPrice
        +LocalDateTime createdAt
        +getProduct() Product
        +getOrder() Order
        +calculateTotalPrice() Long
    }

    class Coupon {
        +String id
        +String code
        +String name
        +CouponType type
        +Long discountValue
        +Long maxDiscount
        +Long minOrderAmount
        +Integer totalQuantity
        +Integer usedQuantity
        +LocalDateTime validFrom
        +LocalDateTime validTo
        +Boolean isActive
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
        +isValid() Boolean
        +canIssue() Boolean
        +calculateDiscount(amount) Long
    }

    class UserCoupon {
        +String id
        +String userId
        +String couponId
        +CouponStatus status
        +LocalDateTime issuedAt
        +LocalDateTime usedAt
        +getUser() User
        +getCoupon() Coupon
        +canUse() Boolean
        +use() Boolean
        +restore() Boolean
    }

    class UserBalance {
        +String id
        +String userId
        +Long balance
        +LocalDateTime updatedAt
        +getUser() User
        +getTransactions() List~PointTransaction~
        +charge(amount) Boolean
        +reserve(amount) Boolean
        +confirm(amount) Boolean
        +release(amount) Boolean
        +getAvailableBalance() Long
    }

    class PointTransaction {
        +String id
        +String userId
        +TransactionType type
        +Long amount
        +Long balanceAfter
        +String reason
        +String referenceId
        +LocalDateTime createdAt
        +getUser() User
        +getUserBalance() UserBalance
    }

    %% 서비스 클래스
    class OrderService {
        -ProductService productService
        -UserBalanceService userBalanceService
        -CouponService couponService
        -OrderRepository orderRepository
        +createOrder(userId, items, couponId) Order
        +processPayment(order) Boolean
        +cancelOrder(orderId) Boolean
        +getOrderHistory(userId) List~Order~
        +handleOrderFailure(order) Boolean
        +recoverPendingOrders() Boolean
        -validateOrderRequest(request) Boolean
        -reserveResources(order) Boolean
        -confirmResources(order) Boolean
        -releaseResources(order) Boolean
    }

    class ProductService {
        -ProductRepository productRepository
        -RedisTemplate redisTemplate
        +getAllProducts() List~Product~
        +getProductById(id) Product
        +getPopularProducts() List~Product~
        +reserveStock(productId, quantity) Boolean
        +confirmStock(productId, quantity) Boolean
        +releaseStock(productId, quantity) Boolean
        +updatePopularProducts() Boolean
        -calculatePopularProducts() List~Product~
    }

    class UserBalanceService {
        -UserBalanceRepository userBalanceRepository
        -PointTransactionRepository pointTransactionRepository
        +getUserBalance(userId) UserBalance
        +chargeBalance(userId, amount) Boolean
        +reserveBalance(userId, amount) Boolean
        +confirmBalance(userId, amount) Boolean
        +releaseBalance(userId, amount) Boolean
        +getTransactionHistory(userId) List~PointTransaction~
        -validateChargeAmount(amount) Boolean
        -createTransaction(userId, type, amount) PointTransaction
    }

    class CouponService {
        -CouponRepository couponRepository
        -UserCouponRepository userCouponRepository
        +issueCoupon(userId, couponCode) UserCoupon
        +getUserCoupons(userId) List~UserCoupon~
        +validateCoupon(userId, couponId) Boolean
        +useCoupon(userId, couponId) Boolean
        +restoreCoupon(userId, couponId) Boolean
        +calculateDiscount(couponId, amount) Long
        -checkCouponEligibility(userId, coupon) Boolean
        -checkCouponAvailability(coupon) Boolean
    }

    class AuthService {
        -UserRepository userRepository
        -JwtService jwtService
        +authenticate(email, password) String
        +verifyToken(token) User
        +register(userDto) User
        +getCurrentUser(token) User
    }

    class RecoveryService {
        -OrderService orderService
        -UserBalanceService userBalanceService
        -ProductService productService
        -CouponService couponService
        +schedulePendingOrderRecovery() Boolean
        +recoverOrder(orderId) Boolean
        +cleanupExpiredReservations() Boolean
        -processPendingOrders() Boolean
    }

    %% 열거형
    class OrderStatus {
        <<enumeration>>
        PENDING
        SUCCESS
        FAILED
        CANCELED
    }

    class CouponType {
        <<enumeration>>
        PERCENTAGE
        FIXED_AMOUNT
    }

    class CouponStatus {
        <<enumeration>>
        ACTIVE
        USED
        EXPIRED
        CANCELED
    }

    class TransactionType {
        <<enumeration>>
        CHARGE
        PAYMENT
        REFUND
        RESERVE
        RELEASE
    }

    %% 관계 정의
    User *-- UserBalance : "has"
    User *-- UserCoupon : "has"
    User *-- Order : "places"
    User *-- PointTransaction : "creates"

    Product *-- OrderItem : "contains"

    Order *-- OrderItem : "contains"
    Order o-- UserCoupon : "uses"

    Coupon o-- UserCoupon : "issued_as"

    UserBalance *-- PointTransaction : "records"

    %% 서비스와 엔티티 간 관계
    OrderService --> Order : "manages"
    OrderService --> OrderItem : "manages"

    ProductService --> Product : "manages"
    ProductService ..> OrderItem : "reads"

    UserBalanceService --> UserBalance : "manages"
    UserBalanceService --> PointTransaction : "creates"
    UserBalanceService ..> User : "reads"

    CouponService --> Coupon : "manages"
    CouponService --> UserCoupon : "manages"
    CouponService ..> User : "reads"

    RecoveryService ..> Order : "reads/updates"
    RecoveryService ..> UserBalance : "restores"
    RecoveryService ..> Product : "restores"
    RecoveryService ..> UserCoupon : "restores"

    %% 서비스 의존성
    OrderService --> ProductService : "uses"
    OrderService --> UserBalanceService : "uses"
    OrderService --> CouponService : "uses"

    RecoveryService --> OrderService : "uses"
    RecoveryService --> UserBalanceService : "uses"
    RecoveryService --> ProductService : "uses"
    RecoveryService --> CouponService : "uses"
```

## 주요 클래스 설명

### 1. 엔티티 클래스

#### User (사용자)

- 시스템 사용자 정보
- 잔액, 쿠폰, 주문 이력과 연관

#### Product (상품)

- 상품 정보 및 재고 관리
- 재고 예약/확정/해제 메소드 제공

#### Order (주문)

- 주문 정보 및 상태 관리
- 할인 적용 및 총액 계산 로직 포함

#### OrderItem (주문 항목)

- 주문 내 개별 상품 정보
- 수량 및 가격 계산

#### Coupon (쿠폰)

- 쿠폰 정보 및 할인 규칙
- 발급 가능 여부 및 할인 계산 로직

#### UserCoupon (사용자 쿠폰)

- 사용자별 쿠폰 발급 및 사용 이력
- 쿠폰 상태 관리

#### UserBalance (사용자 잔액)

- 사용자 잔액 및 예약 잔액 관리
- 충전/예약/확정/해제 메소드 제공

#### PointTransaction (포인트 거래)

- 모든 잔액 변동 이력 기록
- 감사 추적 및 복구 지원

### 2. 서비스 클래스

#### OrderService

- 주문 생성 및 결제 처리 핵심 로직
- 리소스 예약/확정/해제 orchestration

#### ProductService

- 상품 조회 및 재고 관리
- 인기 상품 통계 처리

#### UserBalanceService

- 잔액 충전 및 결제 처리
- 거래 이력 관리

#### CouponService

- 쿠폰 발급 및 사용 처리
- 할인 계산 로직

#### RecoveryService

- 보류 주문 자동 복구
- 만료된 예약 정리

### 3. 주요 설계 특징

1. **원자성 보장**: 모든 리소스 변경은 예약→확정→해제 패턴 사용
2. **복구 가능성**: 모든 상태 변경 추적 및 복구 로직 제공
3. **동시성 제어**: 재고 및 잔액 예약 시스템으로 동시성 문제 해결
4. **확장성**: 서비스 계층 분리로 각 도메인 독립적 확장 가능
5. **금액 처리**: 모든 금액을 정수(Long)로 처리하여 부동소수점 오차 방지

### 4. 할인 처리 방식

#### 할인율 쿠폰 예시

```java
// 10% 할인 쿠폰 적용
long originalAmount = 1235L;  // 1,235원
int discountRate = 10;        // 10%
long discountAmount = originalAmount * discountRate / 100;  // 123원
long finalAmount = originalAmount - discountAmount;         // 1,112원
```

#### 정액 할인 쿠폰 예시

```java
// 2,000원 할인 쿠폰 적용
long originalAmount = 5000L;  // 5,000원
long discountAmount = 2000L;  // 2,000원
long finalAmount = originalAmount - discountAmount;  // 3,000원
```

#### 장점

- 부동소수점 오차 완전 방지
- 정수 연산으로 성능 향상
- 소수점 버림 정책으로 안정성 보장
