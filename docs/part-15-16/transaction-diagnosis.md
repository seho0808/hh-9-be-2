## `STEP 16 Transaction Diagnosis`

### 배포 단위 도메인 분리

- 현재 이미 모듈(도메인) 단위로 서비스가 쪼개져있어서 분리하기 편한 형태입니다.
- 아래 코드와 같이 크로스 도메인 호출은 ProcessOrderUseCase와 같은 order도메인의 최상단 application 계층에 몰려있는 형태입니다.
- 그렇기에 배포 단위를 분리하기 매우 자연스러운 형태로 이미 구성되어있습니다. 지금의 최상위 application 계층 함수 중 몇 개를 이벤트로 분리 시켜 소통 시키면 끝납니다.
- 현존하는 모듈들은 `auth`, `coupon`, `order`, `product`, `user`, `wallet` 이며, 배포 단위로 사용 할 만한 것들은 `auth`를 제외한 모듈들입니다.

```ts
// 단순화 한 ProcessOrderUseCase
@Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
export class ProcessOrderUseCase {
  async execute(command: ProcessOrderCommand) {
    // 쿠폰 적용
    if (userCouponId) {
      const { order: discountedOrder } =
        await this.applyDiscountUseCase.execute({...});
      order = discountedOrder;

      await this.useUserCouponUseCase.execute({...});
    }

    // 잔고 사용
    const finalAmountToPay = order.finalPrice;
    await this.usePointsUseCase.execute({...});

    // 재고 확정
    await Promise.all(
      stockReservationIds.map((stockReservationId) =>
        this.confirmStockUseCase.execute({...})
      )
    );
  }
}

```

- 도메인의 역할은 아래와 같을 것입니다 (테이블도 이미 모듈 마다 분리되어있으며 어플리케이션 계층 최상단 함수가 아니라면 타 도메인끼리 직접 호출하지 않습니다):
  - Order: 주문/주문항목, 상태 전이, 가격 합산, 이벤트 발행
    - DB 테이블: order-items, orders
  - Wallet: 사용자 포인트 잔액, 충전/사용 이력, 한도 정책
    - DB 테이블: point-transactions, user-balances
  - Product: 상품 정보, 재고(예약/차감)
    - DB 테이블: products, stock-reservations
  - Coupon: 쿠폰 정의/발급/사용, 소진 상태
    - DB 테이블: coupons, user_coupons
  - User: 유저 생성, 유저 기본 정보 반환
    - DB 테이블: users

- 현재 도메인끼리 서로 참조하고 있는 부분들을 정리해보았습니다.
  - Order
    - ProcessOrderUseCase (tier-2) → Coupon, Product, Wallet
    - RecoverOrderUseCase (tier-2) → Coupon, Product, Wallet
    - PrepareOrderUseCase (tier-3) → Coupon, Product, Wallet
    - PlaceOrderUseCase (tier-4) → Product
    - AutoRecoverOrdersUseCase (tier-3) → Product
  - Product
    - GetPopularProductsWithDetailUseCase (tier-2) → Order
    - GetPopularProductsRealtimeUseCase (tier-3) → Order (via port)
  - User
    - CreateUserUseCaseWithBalanceUseCase (tier-2) → Wallet

- 이벤트로 변경하였을 때 토폴로지에서 순환참조는 없는 것으로 확인되었습니다.
  - 만약 발생한다면,
    - 타 도메인의 테이블들의 복제 비정규화 버전을 읽는 방법이 있습니다. (이벤트/CDC 동기화)
    - 도메인 바운디드 컨텍스트가 올바르게 설정되었는지 재고할 수도 있습니다.
    - 여러 도메인이 읽는 뷰를 별도 서비스/스토어로 관리가 가능할 수 있습니다.

### 트랜잭션 처리의 한계

- 트랜잭션이 분산 트랜잭션이 되면서 이제는 단일 DB 내에서의 트랜잭션이 불가합니다.
- 우리는 분산된 DB들을 하나의 트랜잭션처럼 묶어줄 대안을 찾아야합니다

#### 2PC? XA?

2PC (Two-Phase Commit) 은 분산 트랜잭션에서 여러 DB/리소스를 원자적으로 커밋/롤백하기 위한 프로토콜이고, XA 는 그 표준 인터페이스라고합니다.

2PC/XA는 아래와 같은 프로세스로 진행된다고 합니다.

1. Prepare 단계 – 코디네이터가 모든 참여 DB에게 “준비됐냐?” 물어봄 → 각 DB는 트랜잭션을 prepare 상태로 기록하고 “OK/Fail” 응답.
2. Commit 단계 – 모두 OK면 코디네이터가 COMMIT, 누가 Fail이면 모두 ROLLBACK 지시.

핵심은 모두 준비되면 동시에 확정, 하나라도 실패하면 전부 취소되는 원자성 보장입니다.

이 2PC/XA는 현업에서 아래의 이유들로 잘 쓰이지 않는다고 합니다:

1. 락 장시간 유지 => 이건 당연해보입니다. 락을 잡은 상태로 타 디비와 통신하는 시간만큼 타 요청들이 기다려야할 것입니다. 특히 네트워크 문제가 생기면 사실상 모두 실패하게 됩니다.
2. 여러 인스턴스가 될수록 확장성이 많이 떨어짐 => 확실히 db 개수가 늘어나거나 그러면 통신도 어려워보입니다.
3. 그 외에도 복구 복잡성, 코디네이터 단일 실패점 등의 이슈가 존재합니다.

이러한 치명적인 문제점들 때문에 우리는 Saga 패턴을 고려해야합니다.

### 트랜잭션 처리 대응 방안

#### Saga

- 각 분산된 트랜잭션들을 하나처럼 묶는 두 개의 알려진 패턴이 존재합니다: Orchestration Saga, Choreography Saga
- Orchestration Saga: 하나의 인스턴스(Orchestrator)에서 책임을 지고 타 도메인 호출을 지휘합니다.
  - 이벤트로 던지든 프로토콜을 쓰든 중앙에서 각 호출이 정상적으로 완료되었는지 확인을 마친 후 전체 프로세스를 종료합니다.
  - 가운데에서 사가 프로세스 상태/로그을 홀로 소유하기에 관리가 편할 수 있습니다.
- Choreography Saga: 각 인스턴스
  - 각 트랜잭션이 종료되면 다음 트랜잭션을 실행시키며 타 도메인으로 next step을 릴레이로 바톤터치합니다.
  - 중간에서 깨지면 복구할 때 다시 반대 방향으로 릴레이 바톤 터치를 하며 복구합니다.
  - 각자 도메인은 각자 할일만 잘 하면되기 때문에 팀마다 책임과 관리 경계가 명확해지는 장점이 있습니다.
- Orchestration, Choreography 패턴을 안전장치들 없이 사용하면 위험할 수 있습니다:
  - 서버 꺼지는 장애 대응
    - 예시) A 도메인 => B 도메인 => C 도메인 순서로 분산된 트랜잭션 처리를 할 때, A에서 B로 가다가 B도메인 서버가 응답을 받고 프로세스 도중 꺼졌을 때 => B는 다시 살아났을 때 실행중이던 프로세스가 뭔지 모릅니다.
    - 이러한 상황을 타개하기 위해 각 도메인에서는 내가 이미 메세지/요청을 보냈다는 사실을 기록해야하고 반대로 받는 입장에서는 어떤 메세지/요청을 받았고 얼마나 처리했는지까지 기록해야합니다.
    - 결국 log테이블이 각 도메인 마다 최소 한 개씩 필요합니다. => 필수로는 outbox가 하나씩 필요.
    - inbox 테이블은 상황에 따라 선택이 될 수 있습니다. (중복 수신 여부를 도메인 테이블만으로 안전하게 판별할 수 없을 때 or 처리 상태 추적 용이성)
      - inbox event_id/message_id랑 상태 정도 갖고 있는게 핵심임.
