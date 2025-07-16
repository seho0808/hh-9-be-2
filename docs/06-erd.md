# ERD (Entity Relationship Diagram)

## 전체 시스템 ERD

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar password
        varchar name
        timestamp created_at
        timestamp updated_at
    }

    products {
        uuid id PK
        varchar name
        text description
        bigint price
        integer total_stock
        integer reserved_stock
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    orders {
        uuid id PK
        uuid user_id FK
        bigint total_amount
        bigint discount_amount
        bigint final_amount
        enum status
        varchar request_id UK
        uuid used_coupon_id FK
        timestamp created_at
        timestamp updated_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        integer quantity
        bigint unit_price
        bigint total_price
        timestamp created_at
    }

    coupons {
        uuid id PK
        varchar code UK
        varchar name
        enum type
        bigint discount_value
        bigint max_discount
        bigint min_order_amount
        integer total_quantity
        integer used_quantity
        timestamp valid_from
        timestamp valid_to
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    user_coupons {
        uuid id PK
        uuid user_id FK
        uuid coupon_id FK
        enum status
        timestamp issued_at
        timestamp used_at
    }

    user_balances {
        uuid id PK
        uuid user_id FK
        bigint balance
        timestamp updated_at
    }

    point_transactions {
        uuid id PK
        uuid user_id FK
        enum type
        bigint amount
        bigint balance_after
        varchar reason
        varchar reference_id
        timestamp created_at
    }

    stock_reservations {
        varchar reservation_id PK
        uuid product_id FK
        uuid user_id FK
        integer quantity
        timestamp created_at
        timestamp expires_at
    }

    %% 관계 정의
    users ||--|| user_balances : has
    users ||--o{ user_coupons : has
    users ||--o{ orders : places
    users ||--o{ point_transactions : creates
    users ||--o{ stock_reservations : makes

    products ||--o{ order_items : contains
    products ||--o{ stock_reservations : reserved

    orders ||--|{ order_items : contains
    orders ||--o| user_coupons : uses

    coupons ||--o{ user_coupons : issued_as

    user_balances ||--o{ point_transactions : records
```

## 테이블 상세 정의

### 1. users (사용자)

| 컬럼       | 타입         | 제약조건                                              | 설명               |
| ---------- | ------------ | ----------------------------------------------------- | ------------------ |
| id         | UUID         | PRIMARY KEY, DEFAULT uuid_generate_v4()               | 사용자 ID          |
| email      | VARCHAR(255) | UNIQUE, NOT NULL                                      | 이메일 (로그인 ID) |
| password   | VARCHAR(255) | NOT NULL                                              | 암호화된 비밀번호  |
| name       | VARCHAR(100) | NOT NULL                                              | 사용자 이름        |
| created_at | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                             | 생성일시           |
| updated_at | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 수정일시           |

**인덱스:**

- `idx_users_email` (email)

### 2. products (상품)

| 컬럼           | 타입         | 제약조건                                              | 설명                |
| -------------- | ------------ | ----------------------------------------------------- | ------------------- |
| id             | UUID         | PRIMARY KEY, DEFAULT uuid_generate_v4()               | 상품 ID             |
| name           | VARCHAR(255) | NOT NULL                                              | 상품명              |
| description    | TEXT         |                                                       | 상품 설명           |
| price          | BIGINT       | NOT NULL                                              | 상품 가격 (원 단위) |
| total_stock    | INTEGER      | NOT NULL, DEFAULT 0                                   | 총 재고 수량        |
| reserved_stock | INTEGER      | DEFAULT 0                                             | 예약된 재고 수량    |
| is_active      | BOOLEAN      | NOT NULL, DEFAULT TRUE                                | 활성화 상태         |
| created_at     | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                             | 생성일시            |
| updated_at     | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 수정일시            |

**인덱스:**

- `idx_products_active` (is_active)
- `idx_products_stock` (total_stock)

### 3. orders (주문)

| 컬럼            | 타입         | 제약조건                                              | 설명                                           |
| --------------- | ------------ | ----------------------------------------------------- | ---------------------------------------------- |
| id              | UUID         | PRIMARY KEY, DEFAULT uuid_generate_v4()               | 주문 ID                                        |
| user_id         | UUID         | NOT NULL, FOREIGN KEY                                 | 사용자 ID                                      |
| total_amount    | BIGINT       | NOT NULL                                              | 총 주문 금액                                   |
| discount_amount | BIGINT       | DEFAULT 0                                             | 할인 금액                                      |
| final_amount    | BIGINT       | NOT NULL                                              | 최종 결제 금액                                 |
| status          | ENUM         | NOT NULL                                              | 주문 상태 (PENDING, SUCCESS, FAILED, CANCELED) |
| request_id      | VARCHAR(255) | UNIQUE, NOT NULL                                      | 중복 요청 방지 ID                              |
| used_coupon_id  | UUID         | FOREIGN KEY                                           | 사용된 쿠폰 ID                                 |
| created_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                             | 생성일시                                       |
| updated_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 수정일시                                       |

**인덱스:**

- `idx_orders_user_id` (user_id)
- `idx_orders_status` (status)
- `idx_orders_created_at` (created_at)
- `idx_orders_request_id` (request_id)

### 4. order_items (주문 항목)

| 컬럼        | 타입      | 제약조건                                | 설명         |
| ----------- | --------- | --------------------------------------- | ------------ |
| id          | UUID      | PRIMARY KEY, DEFAULT uuid_generate_v4() | 주문 항목 ID |
| order_id    | UUID      | NOT NULL, FOREIGN KEY                   | 주문 ID      |
| product_id  | UUID      | NOT NULL, FOREIGN KEY                   | 상품 ID      |
| quantity    | INTEGER   | NOT NULL                                | 주문 수량    |
| unit_price  | BIGINT    | NOT NULL                                | 단가         |
| total_price | BIGINT    | NOT NULL                                | 항목 총 가격 |
| created_at  | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP               | 생성일시     |

**인덱스:**

- `idx_order_items_order_id` (order_id)
- `idx_order_items_product_id` (product_id)

### 5. coupons (쿠폰)

| 컬럼             | 타입         | 제약조건                                              | 설명                                 |
| ---------------- | ------------ | ----------------------------------------------------- | ------------------------------------ |
| id               | UUID         | PRIMARY KEY, DEFAULT uuid_generate_v4()               | 쿠폰 ID                              |
| code             | VARCHAR(50)  | UNIQUE, NOT NULL                                      | 쿠폰 코드                            |
| name             | VARCHAR(255) | NOT NULL                                              | 쿠폰명                               |
| type             | ENUM         | NOT NULL                                              | 할인 타입 (PERCENTAGE, FIXED_AMOUNT) |
| discount_value   | BIGINT       | NOT NULL                                              | 할인값 (% 또는 고정금액)             |
| max_discount     | BIGINT       |                                                       | 최대 할인 금액                       |
| min_order_amount | BIGINT       | DEFAULT 0                                             | 최소 주문 금액                       |
| total_quantity   | INTEGER      | NOT NULL                                              | 총 발급 수량                         |
| used_quantity    | INTEGER      | DEFAULT 0                                             | 사용된 수량                          |
| valid_from       | TIMESTAMP    | NOT NULL                                              | 유효 시작일                          |
| valid_to         | TIMESTAMP    | NOT NULL                                              | 유효 종료일                          |
| is_active        | BOOLEAN      | NOT NULL, DEFAULT TRUE                                | 활성화 상태                          |
| created_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                             | 생성일시                             |
| updated_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 수정일시                             |

**인덱스:**

- `idx_coupons_code` (code)
- `idx_coupons_valid_period` (valid_from, valid_to)
- `idx_coupons_active` (is_active)

### 6. user_coupons (사용자 쿠폰)

| 컬럼      | 타입      | 제약조건                                | 설명                                   |
| --------- | --------- | --------------------------------------- | -------------------------------------- |
| id        | UUID      | PRIMARY KEY, DEFAULT uuid_generate_v4() | 사용자 쿠폰 ID                         |
| user_id   | UUID      | NOT NULL, FOREIGN KEY                   | 사용자 ID                              |
| coupon_id | UUID      | NOT NULL, FOREIGN KEY                   | 쿠폰 ID                                |
| status    | ENUM      | NOT NULL                                | 상태 (ACTIVE, USED, EXPIRED, CANCELED) |
| issued_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP               | 발급일시                               |
| used_at   | TIMESTAMP |                                         | 사용일시                               |

**인덱스:**

- `idx_user_coupons_user_id` (user_id)
- `idx_user_coupons_coupon_id` (coupon_id)
- `idx_user_coupons_status` (status)
- `uk_user_coupons_user_coupon` (user_id, coupon_id) - 중복 발급 방지

### 7. user_balances (사용자 잔액)

| 컬럼       | 타입      | 제약조건                                              | 설명             |
| ---------- | --------- | ----------------------------------------------------- | ---------------- |
| id         | UUID      | PRIMARY KEY, DEFAULT uuid_generate_v4()               | 잔액 ID          |
| user_id    | UUID      | UNIQUE, NOT NULL, FOREIGN KEY                         | 사용자 ID        |
| balance    | BIGINT    | NOT NULL, DEFAULT 0                                   | 사용 가능한 잔액 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 수정일시         |

**인덱스:**

- `idx_user_balances_user_id` (user_id)

### 8. point_transactions (포인트 거래)

| 컬럼          | 타입         | 제약조건                                | 설명                               |
| ------------- | ------------ | --------------------------------------- | ---------------------------------- |
| id            | UUID         | PRIMARY KEY, DEFAULT uuid_generate_v4() | 거래 ID                            |
| user_id       | UUID         | NOT NULL, FOREIGN KEY                   | 사용자 ID                          |
| type          | ENUM         | NOT NULL                                | 거래 타입 (CHARGE, DEDUCT, REFUND) |
| amount        | BIGINT       | NOT NULL                                | 거래 금액                          |
| balance_after | BIGINT       | NOT NULL                                | 거래 후 잔액                       |
| reason        | VARCHAR(255) |                                         | 거래 사유                          |
| reference_id  | VARCHAR(255) |                                         | 참조 ID (주문 ID 등)               |
| created_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP               | 생성일시                           |

**인덱스:**

- `idx_point_transactions_user_id` (user_id)
- `idx_point_transactions_type` (type)
- `idx_point_transactions_created_at` (created_at)
- `idx_point_transactions_reference_id` (reference_id)

### 9. stock_reservations (재고 예약)

| 컬럼           | 타입         | 제약조건                  | 설명                        |
| -------------- | ------------ | ------------------------- | --------------------------- |
| reservation_id | VARCHAR(255) | PRIMARY KEY               | 예약 ID (UUID 또는 복합키)  |
| product_id     | UUID         | NOT NULL, FOREIGN KEY     | 상품 ID                     |
| user_id        | UUID         | NOT NULL, FOREIGN KEY     | 사용자 ID                   |
| quantity       | INTEGER      | NOT NULL                  | 예약 수량                   |
| created_at     | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 예약 생성일시               |
| expires_at     | TIMESTAMP    | NOT NULL                  | 예약 만료일시 (생성 + 30초) |

**인덱스:**

- `idx_stock_reservations_product_id` (product_id)
- `idx_stock_reservations_user_id` (user_id)
- `idx_stock_reservations_expires_at` (expires_at)

**TTL 정책:**

- `expires_at < NOW()` 인 레코드는 자동 삭제 (정기 배치 또는 Redis TTL)
- 예약 만료 시 자동으로 `products.reserved_stock` 차감

## 주요 제약사항 및 비즈니스 규칙

### 1. 데이터 무결성 제약사항

#### 잔액 관리

- `user_balances.balance >= 0` (음수 잔액 불가)
- `user_balances.balance <= 10000000` (최대 보유 한도: 천만원)

#### 재고 관리

- `products.total_stock >= 0` (음수 재고 불가)
- `products.reserved_stock >= 0` (음수 예약 재고 불가)
- `products.reserved_stock <= total_stock` (예약 재고가 총 재고 초과 불가)
- `available_stock = total_stock - reserved_stock` (사용 가능 재고 계산)
- `order_items.quantity > 0` (0개 이하 주문 불가)
- `order_items.quantity <= 10` (상품당 최대 10개)

#### 재고 예약 시스템 (Reserve/Release Pattern)

**기본 개념:**

- **총 재고 (total_stock)**: 실제 보유한 전체 재고량
- **예약 재고 (reserved_stock)**: 주문 진행 중 임시로 확보된 재고량
- **사용 가능 재고 (available_stock)**: `total_stock - reserved_stock` (계산값)

**예약 프로세스:**

1. **reserveStock()**: `reserved_stock += quantity` (여러명 동시요청해도 조건부 업데이트를 통해 - 아래 `동시성 제어`에서 다시 언급됨 - 락걸어서 원자적으로 처리)
2. **confirmStock()**: `total_stock -= quantity, reserved_stock -= quantity` (재고 확정 차감)
3. **releaseStock()**: `reserved_stock -= quantity` (예약 해제)

**TTL 기반 자동 예약 해제:**

- 별도 `stock_reservations` 임시 테이블로 TTL 관리
- 30초 후 자동 `releaseStock()` 실행
- 5분 마다 cron으로 release 안 된 재고 release

```sql
-- 재고 예약 임시 관리 테이블 (Redis 또는 임시 DB 테이블)
stock_reservations {
    varchar reservation_id PK
    uuid product_id FK
    uuid user_id
    integer quantity
    timestamp created_at
    timestamp expires_at  -- created_at + 30초
}
```

**동시성 제어:**

- `UPDATE products SET reserved_stock = reserved_stock + ? WHERE id = ? AND (total_stock - reserved_stock) >= ?`
- 조건부 업데이트로 사용 가능 재고 검증과 예약을 원자적으로 처리

#### 쿠폰 관리

- `coupons.used_quantity <= total_quantity` (사용량이 총량 초과 불가)
- `coupons.valid_from < valid_to` (유효기간 논리적 순서)
- `user_coupons`에서 (user_id, coupon_id) 조합 중복 불가

#### 주문 관리

- `orders.final_amount >= 0` (음수 결제 불가)
- `orders.discount_amount <= total_amount` (할인이 총액 초과 불가)
- `order_items.total_price = unit_price * quantity` (가격 계산 일관성)

#### 할인 처리 방식

- 모든 금액은 정수(원 단위)로 처리
- 할인율 계산: `할인금액 = 원가 * 할인율 / 100` (정수 나눗셈, 소수점 버림)
- 예: 1,235원 × 10% = 123원 (소수점 버림으로 안정성 보장)

### 2. 동시성 제어

#### 재고 관리

- `products.total_stock` 업데이트 시 행 단위 락 필요
- 재고 예약 → 확정 → 해제 순서 보장

#### 잔액 관리

- `user_balances` 업데이트 시 행 단위 락 필요
- 잔액 예약 → 확정 → 해제 순서 보장

#### 쿠폰 관리

- `coupons.used_quantity` 업데이트 시 행 단위 락 필요
- 선착순 발급 시 동시성 제어 필수

### 3. 데이터 보존 및 감사

#### 거래 이력 보존

- `point_transactions` 테이블은 삭제 불가 (INSERT ONLY)
- 모든 잔액 변동 기록 필수

#### 주문 이력 보존

- `orders`, `order_items` 테이블은 삭제 불가
- 취소된 주문도 상태만 변경하여 보존

### 4. 성능 최적화

#### 인기 상품 통계

- 별도 집계 테이블 또는 Redis 캐시 활용
- 3일간 판매량 기준 5분 간격 업데이트

#### 파티셔닝 고려사항

- `point_transactions`: 생성일시 기준 월별 파티셔닝
- `orders`: 생성일시 기준 월별 파티셔닝

### 5. 백업 및 복구

#### 중요 데이터 백업

- 사용자 잔액 정보: 일 단위 백업
- 거래 이력: 증분 백업
- 주문 정보: 일 단위 백업

#### 재해 복구 시나리오

- 잔액 정보 복구: `point_transactions` 기반 재계산
- 주문 상태 복구: 결제 시스템과 대조하여 일관성 확인
