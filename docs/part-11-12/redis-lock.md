# Redis 분산 Lock 최적화 방안

## <0> 전제

- 쿠폰 선착순 발급 시나리오를 테스팅했습니다.
- k6에서 한 번의 uv 시작 호출 마다 가입 - 쿠폰 발급 절차를 거칩니다.
- 완벽과 거리가 있는 벤치마킹이지만 알고리즘끼리의 상대적 비교를 러프하게 측정한 것 정도로 봐주시면 감사할 것 같습니다.
- redlock은 여러 현 테스트에서는 상용 라이브러리 단일 redis로의 성능 벤치마킹 목적으로 사용했습니다.

## <1> 6가지 전략 비교분석 결론

- 저만의 queue 분산락 알고리즘으로 pubsub을 뛰어넘고 싶었으나 pubsub을 뛰어넘지는 못했습니다.
  - 어쩌면 알고리즘 더 튜닝하면 뛰어넘을지도 모르겠다고 생각중입니다.
- 비관락이 압도적으로 빠르고 실패율이 낮았습니다. (아마 로드 자체가 적어서 그럴 수도 있다고 생각했습니다.)
- fencing 로직은 pubsub 위에서 존재하는데, 생각보다 성능이 유사했습니다.
- redlock은 사용 솔루션이라 그런지 실패율이 조금 높았습니다. - 아마 파라미터 조정하면 다른 값이 얼마든지 나올 것이라고 예상중입니다.

## <2> 벤치 마킹 결과

### <2-1> 어떻게 환경 구성을 했는지:

- 로컬 머신에서 도커로 띄워 놓고 테스팅했습니다. (docker-compose up -d)
  - 고로 외부 네트워크나 각종 변수는 확인한 바 없습니다.
  - 맥으로 했으니 서버 머신이랑 차이가 존재합니다.
- 5가지 redis 분산락 전략 + 1가지 db락 전략 (비관락) 하여 총 6가지 전략을 비교했습니다.
- 실제 테스트 돌리는 방법: `scripts/k6-lock-test/README.md`

### <2-2> k6 결과

#### 요약

|                   | db 비관락 | spin   | pubsub | queue  | fencing | redlock |
| ----------------- | --------- | ------ | ------ | ------ | ------- | ------- |
| success_rate 평균 | 100.00%   | 83.88% | 92.66% | 90.64% | 36.25%  | 67.50%  |
| p95 평균          | 3.26s     | 10.50s | 6.26s  | 7.82s  | 5.19s   | 3.62s   |

\*각각 5번의 run의 평균치입니다. 각 run의 세부 결과는 해당 문서 동일 디렉터리 `redis-lock-test-log.md` 참고 부탁드립니다.

#### 옵션 (스파이크 테스트)

```ts
export const options = {
  scenarios: {
    spike_test: {
      executor: "ramping-vus",
      stages: [
        { duration: "10s", target: 20 },
        { duration: "30s", target: 100 },
        { duration: "10s", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    coupon_issue_success_rate: ["rate>0.8"],
  },
};
```

#### 돌리는 법

```shell
# process 1
pnpm i
pnpm run build
pnpm run start

# process 2
docker-compose up -d
npm run seed:coupon
npm run k6:coupon:database # 이후 나올 애들 다 여기만 바꾸면 똑같이 돌아갑니다.
npm run k6
```
