# Redis 분산 Lock 최적화 방안

## <1> 6가지 전략 비교분석 결론

- 저만의 queue 분산락 알고리즘으로 pubsub을 뛰어넘고 싶었으나 spin lock과 다름없는 성능에 그쳤습니다.
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

|              | db 비관락 | spin   | pubsub | queue  | fecing | redlock |
| ------------ | --------- | ------ | ------ | ------ | ------ | ------- |
| success_rate | 100%      | 84.74% | 92.57% | 87.73% | 92.52% | 64.10%  |
| p95          | 3.34s     | 10.47  | 6.63s  | 10.08s | 6.27s  | 3.52s   |

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

#### 1. db 비관락

```shell
# process 1
pnpm i
pnpm run build
pnpm run start

# process 2
docker-compose up -d
npm run seed:coupon
npm run k6:coupon:database # 이후 나올 애들 다 여기만 바꾸면 똑같이 돌아갑니다.
```

```shell
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.34s


  █ TOTAL RESULTS

    checks_total.......................: 4436    54.998119/s
    checks_succeeded...................: 100.00% 4436 out of 4436
    checks_failed......................: 0.00%   0 out of 4436

    ✓ register status is 201
    ✓ register has access token
    ✓ coupon issue status is 201
    ✓ coupon issue has userCoupon

    CUSTOM
    coupon_issue_success_rate...............................................: 100.00% 1109 out of 1109

    HTTP
    http_req_duration.......................................................: avg=1.09s min=5.47ms   med=735.25ms max=4.93s p(90)=2.72s p(95)=3.34s
      { expected_response:true }............................................: avg=1.09s min=5.47ms   med=735.25ms max=4.93s p(90)=2.72s p(95)=3.34s
    http_req_failed.........................................................: 0.00%   0 out of 2218
    http_reqs...............................................................: 2218    27.499059/s

    EXECUTION
    iteration_duration......................................................: avg=2.66s min=324.52ms med=2.09s    max=8.56s p(90)=5.23s p(95)=6.19s
    iterations..............................................................: 1109    13.74953/s
    vus.....................................................................: 1       min=1            max=100
    vus_max.................................................................: 100     min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB  21 kB/s
    data_sent...............................................................: 1.1 MB  14 kB/s
```

#### 2. spin lock

```shell
# process 2
npm run k6:coupon:spinlock
```

```shell
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=84.74%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=10.47s


  █ TOTAL RESULTS

    checks_total.......................: 4130   51.32509/s
    checks_succeeded...................: 92.39% 3816 out of 4130
    checks_failed......................: 7.60%  314 out of 4130

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  84% — ✓ 872 / ✗ 157
    ✗ coupon issue has userCoupon
      ↳  84% — ✓ 872 / ✗ 157

    CUSTOM
    coupon_issue_errors.....................................................: 157    1.951099/s
    coupon_issue_success_rate...............................................: 84.74% 872 out of 1029

    HTTP
    http_req_duration.......................................................: avg=1.26s    min=5.31ms   med=351.39ms max=11.53s p(90)=3.27s  p(95)=10.47s
      { expected_response:true }............................................: avg=574.34ms min=5.31ms   med=326.75ms max=9.53s  p(90)=1.04s  p(95)=1.93s
    http_req_failed.........................................................: 7.60%  157 out of 2065
    http_reqs...............................................................: 2065   25.662545/s

    EXECUTION
    iteration_duration......................................................: avg=2.98s    min=341.37ms med=1.19s    max=13.11s p(90)=11.44s p(95)=11.79s
    iterations..............................................................: 1029   12.787777/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.6 MB 20 kB/s
    data_sent...............................................................: 1.0 MB 13 kB/s
```

#### 3. pubsub lock

```shell
# process 2
npm run k6:coupon:pubsub
```

```shell
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=92.57%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=6.63s


  █ TOTAL RESULTS

    checks_total.......................: 4308   53.620197/s
    checks_succeeded...................: 96.28% 4148 out of 4308
    checks_failed......................: 3.71%  160 out of 4308

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  92% — ✓ 997 / ✗ 80
    ✗ coupon issue has userCoupon
      ↳  92% — ✓ 997 / ✗ 80

    CUSTOM
    coupon_issue_errors.....................................................: 80     0.995733/s
    coupon_issue_success_rate...............................................: 92.57% 997 out of 1077

    HTTP
    http_req_duration.......................................................: avg=1.16s    min=5.89ms  med=494.85ms max=11.24s p(90)=2.77s p(95)=6.63s
      { expected_response:true }............................................: avg=934.68ms min=5.89ms  med=478.74ms max=10.4s  p(90)=1.48s p(95)=4.14s
    http_req_failed.........................................................: 3.71%  80 out of 2154
    http_reqs...............................................................: 2154   26.810098/s

    EXECUTION
    iteration_duration......................................................: avg=2.78s    min=369.8ms med=1.52s    max=12.63s p(90)=7.89s p(95)=10.57s
    iterations..............................................................: 1077   13.405049/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s
```

#### 4. queue lock

```shell
# process 2
npm run k6:coupon:queue
```

```shell
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=87.73%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=10.08s


  █ TOTAL RESULTS

    checks_total.......................: 3766   46.863791/s
    checks_succeeded...................: 93.89% 3536 out of 3766
    checks_failed......................: 6.10%  230 out of 3766

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  87% — ✓ 823 / ✗ 115
    ✗ coupon issue has userCoupon
      ↳  87% — ✓ 823 / ✗ 115

    CUSTOM
    coupon_issue_errors.....................................................: 115    1.43105/s
    coupon_issue_success_rate...............................................: 87.73% 823 out of 938

    HTTP
    http_req_duration.......................................................: avg=1.43s    min=6.78ms   med=596.48ms max=11.33s p(90)=4.01s  p(95)=10.08s
      { expected_response:true }............................................: avg=908.32ms min=6.78ms   med=554.18ms max=10.14s p(90)=1.37s  p(95)=3.95s
    http_req_failed.........................................................: 6.10%  115 out of 1883
    http_reqs...............................................................: 1883   23.431895/s

    EXECUTION
    iteration_duration......................................................: avg=3.32s    min=362.41ms med=1.78s    max=12.37s p(90)=11.01s p(95)=12.02s
    iterations..............................................................: 937    11.65995/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.5 MB 18 kB/s
    data_sent...............................................................: 936 kB 12 kB/s
```

#### 5, fencing lock (pubsub + fencing token)

```shell
# process 2
npm run k6:coupon:fencing
```

```shell
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=92.52%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=6.27s


  █ TOTAL RESULTS

    checks_total.......................: 4336   53.791509/s
    checks_succeeded...................: 96.26% 4174 out of 4336
    checks_failed......................: 3.73%  162 out of 4336

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  92% — ✓ 1003 / ✗ 81
    ✗ coupon issue has userCoupon
      ↳  92% — ✓ 1003 / ✗ 81

    CUSTOM
    coupon_issue_errors.....................................................: 81     1.004869/s
    coupon_issue_success_rate...............................................: 92.52% 1003 out of 1084

    HTTP
    http_req_duration.......................................................: avg=1.17s   min=7.39ms   med=514.71ms max=11.16s p(90)=2.35s p(95)=6.27s
      { expected_response:true }............................................: avg=912.2ms min=7.39ms   med=499.72ms max=10.73s p(90)=1.6s  p(95)=4.21s
    http_req_failed.........................................................: 3.73%  81 out of 2168
    http_reqs...............................................................: 2168   26.895755/s

    EXECUTION
    iteration_duration......................................................: avg=2.78s   min=276.37ms med=1.57s    max=12.53s p(90)=7.5s  p(95)=11.5s
    iterations..............................................................: 1084   13.447877/s
    vus.....................................................................: 1      min=1            max=100
    vus_max.................................................................: 100    min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s
```

#### 6. redlock (상용화 spin lock)

```shell
# process 2
npm run k6:coupon:redlock
```

```shell
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=64.10%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.52s


  █ TOTAL RESULTS

    checks_total.......................: 4480   55.728607/s
    checks_succeeded...................: 82.05% 3676 out of 4480
    checks_failed......................: 17.94% 804 out of 4480

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  64% — ✓ 718 / ✗ 402
    ✗ coupon issue has userCoupon
      ↳  64% — ✓ 718 / ✗ 402

    CUSTOM
    coupon_issue_errors.....................................................: 402    5.000647/s
    coupon_issue_success_rate...............................................: 64.10% 718 out of 1120

    HTTP
    http_req_duration.......................................................: avg=1.09s    min=6.61ms   med=564.28ms max=4.88s p(90)=3s    p(95)=3.52s
      { expected_response:true }............................................: avg=695.01ms min=6.61ms   med=424.74ms max=4.88s p(90)=1.79s p(95)=2.28s
    http_req_failed.........................................................: 17.94% 402 out of 2240
    http_reqs...............................................................: 2240   27.864304/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s    min=275.17ms med=2.03s    max=8s    p(90)=5.4s  p(95)=5.85s
    iterations..............................................................: 1120   13.932152/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.8 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```
