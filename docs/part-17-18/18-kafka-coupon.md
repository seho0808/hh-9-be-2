### 쿠폰 발급 Kafka 메시지 플로우

- 유저 경험: 쿠폰 예약 -> 폴링으로 예약 확정되었는지 확인 -> 확정 -> 프론트에서 성공 알림
- 이렇게 구성한 이유: 이벤트 kafka에서 줄서다가 처리되기까지 오래 걸릴 가능성이 있어서 프론트 입장에서 커넥션 빠르게 끊은 뒤에 폴링하는 것이 더 안정적인 설계라고 판단함.

## 쿠폰 예약

```mermaid

sequenceDiagram
  autonumber
  participant U as User
  participant A as CouponController
  participant R as ReserveUseCase
  participant DB as MySQL
  participant OBX as OutboxPublisher
  participant K as Kafka: issue.usercoupon.reserved

  U->>A: POST /coupons/{id}/issue
  A->>R: execute(id, user, code, idemKey)
  R->>DB: insert Reservation
  R->>DB: append Outbox(event, idemKey)
  A-->>U: 202 Accepted (reservationId)

  Note over OBX,DB: Poll 1s
  OBX->>DB: findNew + markProcessing
  OBX->>K: sendMessage(envelope, key=couponId)
  OBX->>DB: markPublished
```

## 쿠폰 확정

```mermaid

sequenceDiagram
  autonumber
  participant K as Kafka: issue.usercoupon.reserved
  participant C as ReservedConsumer
  participant CNF as ConfirmUseCase
  participant DB as MySQL
  participant ISS as IssueUseCase

  C->>K: subscribe(topic)
  K-->>C: message(JSON)
  C->>CNF: execute(reservationId, idemKey)
  CNF->>DB: load + confirm + save
  CNF->>ISS: execute(couponId, userId, code, idemKey)
  ISS->>DB: persist UserCoupon

  Note over K: partitions=4, key=couponId
```

- 키 포인트
  - **토픽**: `issue.usercoupon.reserved`
  - **파티션**: 4 (관리자 초기화 시 생성)
  - **파티셔닝 키**: `couponId` (주문/쿠폰 단위 순서 보장)
  - **메시지 포맷**: `{ eventId, eventType, timestamp, data, idempotencyKey }`
  - **전송 경로**: 예약 트랜잭션 → Outbox 레코드 → OutboxPublisher 폴링/퍼블리시 → Kafka → Consumer → 예약 확정/발급
