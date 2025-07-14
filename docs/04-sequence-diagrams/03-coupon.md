# 쿠폰 발급 및 조회

## 3-1. [성공] 선착순 쿠폰 발급 → 보유 쿠폰 조회

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

---

## 3-2. [실패] 발급 실패

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

---

## 동시성 문제 해결방안

### 선착순 쿠폰 발급 시 동시성 문제

#### 문제 상황

선착순 쿠폰 발급 시 여러 인스턴스가 동시에 같은 쿠폰의 발급 가능 여부를 확인하고 발급하려고 시도하는 경우

#### 해결 방안: Redis 원자적 연산 (INCR)

##### 플로우차트

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

##### 시퀀스 다이어그램

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

#### 구현 예시

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
