# 멀티 인스턴스 동시성 문제 및 해결방안

## 개요

멀티 인스턴스 환경에서 발생하는 주요 동시성 문제들과 락(Lock) 기반 해결방안을 정리합니다.

---

## 1. 선착순 쿠폰 발급 시 동시성 문제

### 문제 상황

선착순 쿠폰 발급 시 여러 인스턴스가 동시에 같은 쿠폰의 발급 가능 여부를 확인하고 발급하려고 시도하는 경우

### 해결 방안: Redis 원자적 연산 (INCR)

#### 플로우차트

```mermaid
flowchart TD
    Start([쿠폰 발급 요청]) --> Auth[사용자 인증]
    Auth --> DupCheck{이미 발급받은<br/>쿠폰인가?}

    DupCheck -->|Yes| DupError[409 Conflict<br/>이미 발급받은 쿠폰]
    DupCheck -->|No| AtomicIncr[Redis INCR<br/>coupon:used:EVENT2025]

    AtomicIncr --> GetTotal[Redis GET<br/>coupon:total:EVENT2025]
    GetTotal --> Compare{used > total?}

    Compare -->|Yes| Rollback[Redis DECR<br/>coupon:used:EVENT2025]
    Rollback --> SoldOut[410 Gone<br/>쿠폰 소진]

    Compare -->|No| CreateUserCoupon[DB에 user_coupon 생성]
    CreateUserCoupon --> DBSuccess{DB 생성 성공?}

    DBSuccess -->|Yes| Success[200 OK<br/>쿠폰 발급 완료]
    DBSuccess -->|No| CompensateDecr[Redis DECR<br/>coupon:used:EVENT2025]
    CompensateDecr --> DBError[500 Internal Error<br/>DB 오류]

    style AtomicIncr color:#111,fill:#ff9800
    style Rollback color:#111,fill:#f44336
    style CompensateDecr color:#111,fill:#f44336
```

#### 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant User as 사용자
    participant API as API 서버
    participant Redis as Redis
    participant DB as Database

    User->>API: 쿠폰 발급 요청
    API->>API: 사용자 인증

    API->>DB: 중복 발급 체크
    DB-->>API: 발급 이력 조회 결과

    alt 이미 발급받은 쿠폰인 경우
        API-->>User: 409 Conflict<br/>(이미 발급받은 쿠폰)
    else 신규 발급 가능한 경우
        API->>Redis: INCR coupon:used:EVENT2025
        Redis-->>API: 증가된 사용량 반환

        API->>Redis: GET coupon:total:EVENT2025
        Redis-->>API: 총 수량 반환

        alt 수량 초과인 경우
            API->>Redis: DECR coupon:used:EVENT2025<br/>(롤백)
            Redis-->>API: 감소된 사용량 반환
            API-->>User: 410 Gone<br/>(쿠폰 소진)
        else 수량 충분한 경우
            API->>DB: user_coupon 생성
            alt DB 생성 성공
                DB-->>API: 생성 완료
                API-->>User: 200 OK<br/>(쿠폰 발급 완료)
            else DB 생성 실패
                DB-->>API: 생성 실패
                API->>Redis: DECR coupon:used:EVENT2025<br/>(보상 트랜잭션)
                Redis-->>API: 감소된 사용량 반환
                API-->>User: 500 Internal Error<br/>(DB 오류)
            end
        end
    end
```

### 구현 예시

```typescript
async issueCoupon(userId: string, couponCode: string) {
  // 1. 중복 발급 체크
  const existingCoupon = await this.findUserCoupon(userId, couponCode);
  if (existingCoupon) {
    throw new ConflictException('이미 발급받은 쿠폰입니다');
  }

  // 2. 원자적 증가
  const usedCount = await this.redis.incr(`coupon:used:${couponCode}`);
  const totalCount = await this.redis.get(`coupon:total:${couponCode}`);

  // 3. 수량 초과 체크
  if (usedCount > parseInt(totalCount)) {
    await this.redis.decr(`coupon:used:${couponCode}`);
    throw new GoneException('쿠폰이 모두 소진되었습니다');
  }

  try {
    // 4. DB에 사용자 쿠폰 생성
    return await this.createUserCoupon(userId, couponCode);
  } catch (error) {
    // 5. DB 실패 시 보상 트랜잭션
    await this.redis.decr(`coupon:used:${couponCode}`);
    throw error;
  }
}
```

---

## 2. 배치 작업 중복 실행 문제

### 문제 상황

여러 인스턴스에서 동시에 같은 보류 주문을 복구하려고 시도하는 경우

### 해결 방안: Redis 분산 락 (SET NX EX)

#### 2-1. 플로우차트

```mermaid
flowchart TD
    Start([복구 스케줄러 실행<br/>1분마다]) --> GetPending[보류 주문 목록 조회]
    GetPending --> HasOrders{보류 주문 있나?}

    HasOrders -->|No| End([스케줄러 종료])
    HasOrders -->|Yes| LoopStart[각 주문별 처리 시작]

    LoopStart --> TryLock[분산 락 시도<br/>Redis SET NX EX<br/>recovery:orderId]

    TryLock --> LockResult{락 획득 성공?}
    LockResult -->|No| NextOrder[다음 주문으로 or<br/>타 인스턴스가 처리 중이면 스킵]
    LockResult -->|Yes| ProcessRecovery[복구 작업 실행]

    ProcessRecovery --> RestoreBalance[잔액 복구]
    RestoreBalance --> RestoreStock[재고 예약 해제]
    RestoreStock --> RestoreCoupon[쿠폰 복구]
    RestoreCoupon --> UpdateOrderStatus[주문 상태 → CANCELED]

    UpdateOrderStatus --> RecoverySuccess{복구 성공?}
    RecoverySuccess -->|Yes| ReleaseLock[락 해제<br/>Redis DEL]
    RecoverySuccess -->|No| HandleError[복구 실패 처리]

    HandleError --> ReleaseLock
    ReleaseLock --> NextOrder

    NextOrder --> MoreOrders{더 처리할 주문?}
    MoreOrders -->|Yes| LoopStart
    MoreOrders -->|No| End

    subgraph "락 자동 해제"
        LockTTL[60초 TTL] --> AutoRelease[자동 락 해제<br/>프로세스 장애 대비]
    end

    style TryLock color:#111,fill:#2196f3
    style ReleaseLock color:#111,fill:#2196f3
    style ProcessRecovery color:#111,fill:#ff9800
    style HandleError color:#111,fill:#f44336
```

#### 2-2. 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant Scheduler as 스케줄러
    participant Instance1 as 인스턴스1
    participant Instance2 as 인스턴스2
    participant Redis as Redis
    participant DB as Database
    participant WalletService as 지갑 서비스
    participant ProductService as 상품 서비스
    participant CouponService as 쿠폰 서비스

    Note over Scheduler: 1분마다 실행

    Scheduler->>Instance1: 복구 스케줄러 시작
    Scheduler->>Instance2: 복구 스케줄러 시작

    Instance1->>DB: 보류 주문 목록 조회
    Instance2->>DB: 보류 주문 목록 조회
    DB-->>Instance1: 보류 주문 리스트
    DB-->>Instance2: 보류 주문 리스트

    par 각 인스턴스가 동시에 처리
        Instance1->>Redis: SET NX EX recovery:order1<br/>(분산 락 시도)
        Instance2->>Redis: SET NX EX recovery:order1<br/>(분산 락 시도)

        Redis-->>Instance1: OK (락 획득 성공)
        Redis-->>Instance2: NULL (락 획득 실패)

        Instance2->>Instance2: 다음 주문으로 이동<br/>(다른 인스턴스가 처리 중이면 스킵)

        Instance1->>WalletService: 잔액 복구 요청
        WalletService-->>Instance1: 잔액 복구 완료

        Instance1->>ProductService: 재고 예약 해제 요청
        ProductService-->>Instance1: 재고 예약 해제 완료

        Instance1->>CouponService: 쿠폰 복구 요청
        CouponService-->>Instance1: 쿠폰 복구 완료

        Instance1->>DB: 주문 상태 → CANCELED
        DB-->>Instance1: 상태 업데이트 완료

        Instance1->>Redis: DEL recovery:order1<br/>(락 해제)
        Redis-->>Instance1: 삭제 완료
    end

    Note over Redis: 60초 TTL로<br/>자동 락 해제<br/>(프로세스 장애 대비)
```

#### 2-3. 시퀀스 다이어그램 2

```mermaid
sequenceDiagram
    participant Instance1
    participant Instance2
    participant Redis
    participant DB

    Note over Instance1, Instance2: 둘 다 같은 보류 주문 목록을 조회함

    Instance1->>DB: 보류 주문 조회
    Instance2->>DB: 보류 주문 조회
    DB-->>Instance1: [order-1, order-2, order-3, order-4]
    DB-->>Instance2: [order-1, order-2, order-3, order-4]

    par Instance1의 for loop
        Instance1->>Redis: SET NX recovery:order-1
        Redis-->>Instance1: OK (락 획득 성공)
        Instance1->>Instance1: order-1 복구 작업 시작...

        Instance1->>Redis: SET NX recovery:order-2
        Redis-->>Instance1: NULL (락 획득 실패)
        Instance1->>Instance1: order-2 건너뛰고 다음으로

        Instance1->>Redis: SET NX recovery:order-3
        Redis-->>Instance1: OK (락 획득 성공)
        Instance1->>Instance1: order-3 복구 작업 시작...
    and Instance2의 for loop
        Instance2->>Redis: SET NX recovery:order-1
        Redis-->>Instance2: NULL (락 획득 실패)
        Instance2->>Instance2: order-1 건너뛰고 다음으로

        Instance2->>Redis: SET NX recovery:order-2
        Redis-->>Instance2: OK (락 획득 성공)
        Instance2->>Instance2: order-2 복구 작업 시작...

        Instance2->>Redis: SET NX recovery:order-3
        Redis-->>Instance2: NULL (락 획득 실패)
        Instance2->>Instance2: order-3 건너뛰고 다음으로

        Instance2->>Redis: SET NX recovery:order-4
        Redis-->>Instance2: OK (락 획득 성공)
        Instance2->>Instance2: order-4 복구 작업 시작...
    end

```

### 구현 예시

```typescript
@Cron('*/1 * * * *')
async recoverPendingOrders() {
  const pendingOrders = await this.orderRepository.findPendingOrders();

  for (const order of pendingOrders) {
    const lockKey = `recovery:${order.id}`;

    // 분산 락 획득 시도 (60초 TTL)
    const lockAcquired = await this.redis.set(
      lockKey,
      'locked',
      'PX', 60000,
      'NX'
    );

    if (lockAcquired === 'OK') {
      try {
        await this.recoverSingleOrder(order);
        this.logger.log(`Order ${order.id} recovered successfully`);
      } catch (error) {
        this.logger.error(`Failed to recover order ${order.id}`, error);
      } finally {
        // 락 해제
        await this.redis.del(lockKey);
      }
    } else {
      this.logger.debug(`Order ${order.id} is being recovered by another instance`);
    }
  }
}

private async recoverSingleOrder(order: Order) {
  // 1. 잔액 복구
  await this.walletService.restoreBalance(order.userId, order.finalAmount);

  // 2. 재고 예약 해제
  for (const item of order.items) {
    await this.productService.releaseStockReservation(item.productId, order.userId);
  }

  // 3. 쿠폰 복구
  if (order.usedCouponId) {
    await this.couponService.restoreCoupon(order.userId, order.usedCouponId);
  }

  // 4. 주문 상태 업데이트
  await this.orderRepository.updateStatus(order.id, OrderStatus.CANCELED);
}
```
