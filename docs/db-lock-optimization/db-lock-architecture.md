## 동시성 이슈 DB Lock 최적화 방안

### 0. 요약

| 도메인         | 읽기 패턴 | 쓰기 패턴           | 경합 강도 | 선택한 락                  | 근거                     |
| -------------- | --------- | ------------------- | --------- | -------------------------- | ------------------------ |
| 지갑           | 자주      | 자주                | Low       | Optimistic                 | 개별 row라 **폭주 없음** |
| 쿠폰 available | 적음      | 매우 잦음, 단일 row | High      | Pessimistic                | **단 1 셀 집중**         |
| 쿠폰 used      | 적음      | 중간                | Mid-Low   | Optimistic                 | 경합 많지 않음 가정      |
| 재고-Hot       | 잦음      | 잦음                | High      | Pessimistic + Token bucket | 인기 상품만              |
| 재고-Cold      | 잦음      | 잦음                | Low       | Optimistic                 | 일반 상품                |

### 1. 지갑

- 포인트 차감은 유저 각자의 row에서 경합이 발생하기에 하나의 행에 트래픽이 폭주하는 시나리오가 거의 없다고 판단했습니다.
- 본인이 스스로 여러 번 충전하거나 사용한 포인트들이 네트워크 어디엔가 큐잉되었다가 한 번에 밀려들어오는 등의 케이스가 대다수일 것이라 생각했습니다.
- 그렇다면 낙관적 락의 retry만으로도 충분히 커버될 것이라고 생각했습니다.
- 하나의 행에 트래픽이 강하게 몰리는 시나리오는 없다고 봤습니다.

### 2. 쿠폰 - available_count

- 쿠폰의 경우에는 단 하나의 행의 단 하나의 컬럼에 (딱 하나의 셀에) 모든 트래픽이 몰립니다. - 바로 available_count입니다. (제 db에서는 total_count, issued_count로 구현되어있음을 참고부탁드립니다.)
- available_count 때문에 쿠폰에는 비관적 락이 유리합니다. retry 할 시간에 비관적 락 대기하는 것이 빠르고, retry 최대 횟수 실패도 적어집니다.
- 하지만! 현재 제 정책으로는 사용, 복구, 취소 등의 시나리오에서 모두 available_count는 건드리지 않습니다.
- 그렇기에 사용, 복구, 취소는 트래픽이 예상치 못하게 피킹 할 일이 적다고 생각하여 낙관적 락이 맞다고 생각합니다.
- 근데 available_count 단 하나의 컬럼 때문에 사용, 복구, 취소가 모두 비관적 락이 되어야하니... 비효율적이어보였습니다.

그래서 생각한 개선안 2개가 존재했습니다:

- 1안. UPDATE available_count = available_count ± Δ 사용 => 이건 어플리케이션 레벨에서 정책 변경이 불편함.
- 2안. available_count를 테이블로 분리 (제 프로젝트에서는 available_count가 아니라 total_count, issued_count) => pessimistic lock에 의한 lock을 제일 적게 잡아먹음.

저는 2안이 지금의 최선책이라고 생각중입니다.
테이블을 분리했기 때문에 available_count만 있는 테이블은 비관적 락으로 잡고, coupon 테이블은 아무 락도 잡지 않은 상태로 함께 트랜잭션에 묶여서 진행됩니다.

시간이 부족하여 coupon 도메인의 코드는 아직 모두 비관적락으로 구현되어있습니다. 하지만 위에 말씀드린대로 total_count, issued_count만 분리한 테이블을 두고 거기에서만 락을 쥐도록 구현을 변경해야합니다.

### 3. 쿠폰 - used_count

- "쿠폰 사용"유스케이스에 트래픽 몰린다면 used_count도 available_count와 유사하게 처리되어야합니다.
- 지금은 쿠폰 사용은 트래픽이 크게 몰리지 않는다고 가정했습니다. 그래서 낙관적 락으로 충분하다고 생각했습니다.

### 4. 재고

- 재고는 테이블을 나누지 않아도 될 것 같았습니다.
  - 재고의 경우 쿠폰과 유사하게 available_stock을 테이블로 분리할 수 있긴합니다.
  - 하지만 쿠폰과 다르게 재고 예약, 해제, 확정 케이스 모두 available_stock을 건드립니다.
  - 그래서 product 자체가 항상 available_stock이랑 함께 움직인다고 느꼈습니다. (통계 낼 때에도)
  - 그렇다면 굳이 테이블 분리가 필요없이 모두 비관적 락으로 가도된다고 생각했습니다. (나중에 요구사항에 따라 필요성에 따라 분리)

- 비인기 상품은 낙관적 락으로 처리하고 싶었습니다.
  - 쿠폰과 다르게 재고의 경우 인기 있는 상품이 있고 인기 없는 상품이 있습니다.
  - 그런 경우에는 redis에 hot 재고 목록을 지정해두고, hotStockReserveUsecase, coldStockReserveUsecase 이렇게 나눌 수 있다고 생각했습니다.
  - 이렇게 나누는 경우, hot은 비관적 락 유스케이스로 구현, cold는 낙관적 락 유스케이스로 구현 할 수 있습니다.
  - 락 걸리는 행이 인기 상품 행으로 최소화됩니다.
  - 구현 난이도로 현재 redis를 이용한 hot, cold 구분은 구현하지 않았습니다.

    ```ts
    /* ------------ Redis util --------------- */
    const isHot = (pid: string) => redis.sismember("hot_products", pid);

    /* ------------ 단일 엔드포인트 --------------- */
    async function reserve(pid: string, q: number, userId: string) {
      return (await isHot(pid))
        ? hotReserveUsecase(pid, q, userId)
        : coldReserveUsecase(pid, q, userId);
    }

    /* ------------ Hot : 토큰 버킷 + 비관적 락 --------------- */
    async function hotReserveUsecase(pid: string, q: number, userId: string) {
      // 비관적 락으로 구현
    }

    /* ------------ Cold : 낙관적 락 --------------- */
    async function coldReserveUsecase(pid: string, q: number, userId: string) {
      // 낙관적 락으로 구현
    }
    ```

### 5. 기타 고려 사항

- 데드락 최소화를 위해 도메인 마다 구현하면서 락을 똑같은 순서로 가져가도록 설정했습니다. (읽는 순서도 그냥 통일했습니다.)
  - couponCounter -> userCoupon (-> coupon은 락 안 집어감)
    - couponCounter은 공유 테이블이라 경합 가능성 훨씬 많이 존재하여 먼저 빨리 락 잡는 것이 좋음.
  - product -> stockReservation
    - product가 더 주요 컬럼이라 경합이 많을 것이라 먼저 잡는 것으로 디폴트 (couponCounter와 똑같은 이유)
- 낙관적 락 retry를 편하게 구현하기 위해 커스텀 decorator(어노테이션)를 구현했습니다. (`common/decorators`에 존재)
- 낙관적 락은 현재 5번 retry로 통일해두었습니다.
- 비관적 락은 대기가 길어질 경우 timeout 오류를 던져야할 수도 있는데... 챕터3에서 구현될 어플리케이션 계층의 동시성 처리들로 커버하는게 맞아보여서 생략했습니다.
  - 디버깅하다가 실제로 마주한 건데, mysql 디폴트 lock timeout이 있고 50초인 것으로 확인했습니다.
