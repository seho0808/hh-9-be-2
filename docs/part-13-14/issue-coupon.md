## 요구사항

e-commerce 선착순 쿠폰발급 기능에 대해 Redis 기반의 설계를 진행하고, 적절하게 동작할 수 있도록 쿠폰 발급 로직을 개선해 제출

## 배경

쿠폰 발급은 쿠폰 발급 수량에 대해 DB 락 경합이 심합니다. (동시성 이슈 해결을 위한 비관적 락이 들어가기 때문에)
그 외에는 사실 쿠폰 도메인에서 경합이 심각하게 발생 할 일이 없습니다.
발급의 DB의 락 경합의 부작용 줄이기 위한 방법들은 여러가지가 있습니다.

- 경합이 많이 심하면 발급 카운터만 테이블을 분리할 수 있습니다. 그러면 Coupon 테이블의 기본정보만 READ하는 기능들은 락으로부터 자유롭습니다.
- 발급 카운터를 아예 Redis/Valkey로 빼서 DB에서 경합이 안 발생하도록 할 수 있습니다.

<br/>

## 전제

- 제 현재 프로그램에는 사실 사용 수량도 존재해서 사용에 사람이 몰리면 경합이 또 발생하긴합니다.
- 과제 스코프를 발급 카운터에만 경합이 생긴다고 전제하고 진행했습니다.

<br/>

## 설계

1. 기본 설계:
   - redis에서 발급 카운터만 체크
   - db coupon 테이블에서는 발급 카운터 아예 제거. (실제로는 제거하진 않고 신규 유스케이스에서만 미사용하는 방식으로 구현했습니다.)
   - db에서는 userCoupon 발급 -> 실패하면 Redis도 롤백
   - userCoupon은 insert만 되기에 락 경합이 없습니다.

2. redis에 queue를 도입하지 않은 이유
   - db 경합이 없어져서 백프레셔 처리가 필요 없다고 생각했습니다.
   - 이슈 트래킹을 위해 누가 발급받았는지 중복 기록할 필요 없다고 생각했습니다.
     - userCoupon의 insert가 성공하지 않으면 레디스 숫자 차감도 성공하지 않도록 해놓았습니다.
     - 그래서 중복 기록을 굳이 안해도 정합성 이슈가 생기지 않는다고 생각했습니다.

3. 현재 문제 생기는 시나리오는 원자성 이슈
   - db에 insert했고 redis도 차감했는데 insert commit 직전에 서버 꺼질 때입니다. (db랑 redis는 트랜잭션 원자성 보장이 함께는 안되기에 생기는 문제)

   ```ts
   // 수도 코드
   await redis.if_possible_subtract()
   const t = transaction;
   try {
     await db.insert(data, t)
     // 여기서 서버 꺼짐
     t.commit() // 서버 재시작하면 redis만 차감되어있음...
   } catch() {
     t.revert()
     try {
     await redis.add()
     } catch() {}
   }

   // 혹은 반대로 db 적용 => redis 차감해도 유사한 문제 발생.
   ```

   - 해결법 1 db에 로그 남기기: transactional outbox 패턴 사용하면 해결되긴합니다. 사실상 userCoupon을 outbox라고 생각하고 redis에서 후처리 받아도 됩니다.
   - 해결법 2 redis에 로그 남기기: 다른 방법으로는 redis에 큐 전체 기록해두고 하나씩 백엔드에서 처리하는 방식입니다. 이러면 outbox가 redis안에 있고 db가 후처리 되는 방식입니다.

<br/>

## 해결법 상세

- 위에서 언급한 이슈에 대한 해결법 상세입니다.
- 이번 과제에서는 실제로 구현하지는 않았습니다.

### 1. DB에 로그 남기기

#### 시나리오

- 요청 수신: DB 트랜잭션에서 user_coupon(PENDING) + outbox_event(NEW) 동시 커밋
- 워커: NEW 이벤트를 락으로 집어와 Redis Lua 실행(멱등 + 차감 + 중복검사)
- 결과 반영: 성공이면 CONFIRMED, 재고없음/중복이면 REJECTED, 실패면 재시도/백오프
- 최종 사용자 응답: 폴링/웹훅/푸시로 PENDING → CONFIRMED/REJECTED 상태를 전달

#### 복구 시나리오

1. API 트랜잭션 커밋 전 크래시
   - 상태: user_coupon(PENDING) + outbox(NEW) 같은 트랜잭션이라 커밋 실패 시 둘 다 없음.
   - 복구: 클라이언트 재시도 시 idem_key로 다시 시도 → 중복 없이 재생성.

2. API 커밋 후(= PENDING/NEW 생성) 크래시
   - 상태: DB에는 PENDING과 outbox: NEW가 남아있음.
   - 복구: 워커가 NEW를 집어가 처리. (시간이 조금 늦어질 뿐, 정합성 이상 없음)

3. 워커가 이벤트 “픽업 후” 크래시
   - 패턴: 리스(lease) 를 둡니다.
     outbox.status = 'SENDING', processing_deadline = now()+N초, worker_id 기록
     워커가 죽으면 deadline 경과 후 다른 워커가 다시 NEW/SENDING(만료)만 집어감(또는 실패로 되돌림)
   - 복구: 다른 워커가 같은 이벤트를 재집어가 재시도.

4. Redis 차감 성공 직후, DB 확정(confirmed/rejected) 전 크래시
   - 위험: “Redis는 이미 차감되었는데, DB는 여전히 PENDING”
   - 해결: Redis 멱등키 = outboxEventId.
     Lua가 event_processed:{eventId}를 세팅하므로, 재실행 시 DUP_EVENT 를 반환 → DB 확정만 수행하면 됨.
   - 복구: 다음 워커가 같은 이벤트를 재처리 → Redis는 “이미 처리됨”을 알려주고, 워커가 DB를 CONFIRMED로 맞춤.

5. DB 확정(confirmed/rejected) 커밋 성공 직후, outbox를 SENT로 바꾸기 전 크래시
   - 해결: DB 안에서 user_coupon 업데이트와 outbox.status='SENT'를 같은 트랜잭션으로 커밋합니다.
     즉, “비즈 상태 변경”과 “아웃박스 상태 전이”는 항상 한 트랜잭션.
   - 복구: 커밋이 끝났으면 끝, 커밋이 안 됐으면 둘 다 미반영이므로 다음 시도에서 다시 시도됨.

6. DB 확정 커밋 성공, outbox SENT 커밋 성공 후 크래시
   - 상태: 이미 완결. 재시도돼도 멱등 조건이 걸려서 변화 없음 (DUP_EVENT, 또는 DB CONFIRMED 중복 업데이트 무해).

#### 단점

- 운영 복잡도 증가: outbox 테이블/워커/재시도·청소 작업 관리
- 사용자 체감 지연: PENDING → 최종 확정까지 약간의 레이턴시
- DB 부하/팽창: outbox 쓰기·인덱스 증가, 대량 트래픽 시 테이블 팽창

### 2. Redis에 로그 남기기

#### 시나리오

- API 요청 시 **Redis 큐/Stream**에 이벤트를 기록 (`XADD`/`LPUSH`)
- Lua 스크립트로 **원자적 처리**:
  - 이벤트 멱등 체크(eventId/idemKey)
  - 유저 중복 체크(user_claim:{couponId}:{userId})
  - 재고 확인 및 차감(stock:{couponId})
- API는 `PENDING` 상태 응답
- 워커가 큐에서 이벤트를 읽어 DB에 `user_coupon` 저장
  - 결과: `CONFIRMED`(성공), `REJECTED`(중복/재고 없음)

#### 복구 시나리오

1. **API 크래시**
   - 이벤트 기록 실패 → 클라이언트 재시도 (idemKey로 중복 방지)
2. **워커 크래시(픽업 후)**
   - Streams/List 재시도 가능, `XPENDING`/리스 만료 후 다른 워커가 이어받음
3. **Redis 차감 성공, DB 확정 전 크래시**
   - 멱등키(event_processed:{eventId})로 중복 방지 → 재시도 시 DB만 확정
4. **DB 확정 성공, Ack 전 크래시**
   - 재인출 시 `DUP_EVENT` 반환, Ack만 다시 수행 → 무해

#### 단점

- Redis 내구성(AOF/Replica) 운영 필요
- 정확히 한 번 처리(exactly-once)는 불가, 멱등 설계 필수
