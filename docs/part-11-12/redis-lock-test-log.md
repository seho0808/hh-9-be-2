# Redis Lock 알고리즘 성능 분석 요약

```shell
## 결과 정리 스크립트
node redis-lock-result-stats.js
```

## 통계 분석 결과 (95% 신뢰구간)

| Algorithm    | Metric           | Mean   | Std Dev | 95% CI Lower | 95% CI Upper |
| ------------ | ---------------- | ------ | ------- | ------------ | ------------ |
| **database** | Success Rate (%) | 100.00 | 0.00    | 100.00       | 100.00       |
| **database** | Duration (s)     | 3.26   | 0.08    | 3.16         | 3.37         |
| **spinlock** | Success Rate (%) | 83.88  | 0.80    | 82.88        | 84.88        |
| **spinlock** | Duration (s)     | 10.50  | 0.03    | 10.46        | 10.53        |
| **pubsub**   | Success Rate (%) | 92.66  | 0.57    | 91.95        | 93.37        |
| **pubsub**   | Duration (s)     | 6.26   | 0.25    | 5.95         | 6.57         |
| **queue**    | Success Rate (%) | 90.64  | 1.91    | 88.28        | 93.01        |
| **queue**    | Duration (s)     | 7.82   | 1.28    | 6.23         | 9.41         |
| **fencing**  | Success Rate (%) | 36.25  | 1.27    | 34.68        | 37.82        |
| **fencing**  | Duration (s)     | 5.19   | 0.78    | 4.21         | 6.16         |
| **redlock**  | Success Rate (%) | 67.50  | 2.61    | 64.26        | 70.75        |
| **redlock**  | Duration (s)     | 3.62   | 0.07    | 3.54         | 3.71         |

## 주요 발견사항

### Success Rate 순위

1. **Database Lock**: 100.00% (표준편차: 0.00)
2. **Pub/Sub**: 92.66% (95% CI: 91.95% - 93.37%)
3. **Queue**: 90.64% (95% CI: 88.28% - 93.01%)
4. **Spinlock**: 83.88% (95% CI: 82.88% - 84.88%)
5. **Redlock**: 67.50% (95% CI: 64.26% - 70.75%)
6. **Fencing**: 36.25% (95% CI: 34.68% - 37.82%)

### Duration (95th percentile) 순위

1. **Database Lock**: 3.26초 (95% CI: 3.16 - 3.37초)
2. **Redlock**: 3.62초 (95% CI: 3.54 - 3.71초)
3. **Fencing**: 5.19초 (95% CI: 4.21 - 6.16초)
4. **Pub/Sub**: 6.26초 (95% CI: 5.95 - 6.57초)
5. **Queue**: 7.82초 (95% CI: 6.23 - 9.41초)
6. **Spinlock**: 10.50초 (95% CI: 10.46 - 10.53초)

---

## 상세 테스트 결과

## database

database 1회차

```
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

database 2회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.36s


  █ TOTAL RESULTS

    checks_total.......................: 4464    55.747831/s
    checks_succeeded...................: 100.00% 4464 out of 4464
    checks_failed......................: 0.00%   0 out of 4464

    ✓ register status is 201
    ✓ register has access token
    ✓ coupon issue status is 201
    ✓ coupon issue has userCoupon

    CUSTOM
    coupon_issue_success_rate...............................................: 100.00% 1116 out of 1116

    HTTP
    http_req_duration.......................................................: avg=1.08s min=8.35ms   med=700.53ms max=5.01s p(90)=2.81s p(95)=3.36s
      { expected_response:true }............................................: avg=1.08s min=8.35ms   med=700.53ms max=5.01s p(90)=2.81s p(95)=3.36s
    http_req_failed.........................................................: 0.00%   0 out of 2232
    http_reqs...............................................................: 2232    27.873916/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s min=332.96ms med=2.21s    max=8.56s p(90)=5.34s p(95)=6.17s
    iterations..............................................................: 1116    13.936958/s
    vus.....................................................................: 1       min=1            max=100
    vus_max.................................................................: 100     min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB  22 kB/s
    data_sent...............................................................: 1.1 MB  14 kB/s
```

database 3회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.24s


  █ TOTAL RESULTS

    checks_total.......................: 4472    55.820096/s
    checks_succeeded...................: 100.00% 4472 out of 4472
    checks_failed......................: 0.00%   0 out of 4472

    ✓ register status is 201
    ✓ register has access token
    ✓ coupon issue status is 201
    ✓ coupon issue has userCoupon

    CUSTOM
    coupon_issue_success_rate...............................................: 100.00% 1118 out of 1118

    HTTP
    http_req_duration.......................................................: avg=1.09s min=4.56ms   med=818.95ms max=4.35s p(90)=2.74s p(95)=3.24s
      { expected_response:true }............................................: avg=1.09s min=4.56ms   med=818.95ms max=4.35s p(90)=2.74s p(95)=3.24s
    http_req_failed.........................................................: 0.00%   0 out of 2236
    http_reqs...............................................................: 2236    27.910048/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s min=320.71ms med=2.15s    max=7.2s  p(90)=5.39s p(95)=5.97s
    iterations..............................................................: 1118    13.955024/s
    vus.....................................................................: 1       min=1            max=100
    vus_max.................................................................: 100     min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB  22 kB/s
    data_sent...............................................................: 1.1 MB  14 kB/s
```

database 4회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.18s


  █ TOTAL RESULTS

    checks_total.......................: 4452    55.413901/s
    checks_succeeded...................: 100.00% 4452 out of 4452
    checks_failed......................: 0.00%   0 out of 4452

    ✓ register status is 201
    ✓ register has access token
    ✓ coupon issue status is 201
    ✓ coupon issue has userCoupon

    CUSTOM
    coupon_issue_success_rate...............................................: 100.00% 1113 out of 1113

    HTTP
    http_req_duration.......................................................: avg=1.09s min=4.82ms   med=773.21ms max=3.73s p(90)=2.72s p(95)=3.18s
      { expected_response:true }............................................: avg=1.09s min=4.82ms   med=773.21ms max=3.73s p(90)=2.72s p(95)=3.18s
    http_req_failed.........................................................: 0.00%   0 out of 2226
    http_reqs...............................................................: 2226    27.706951/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s min=325.54ms med=2.05s    max=7.59s p(90)=5.47s p(95)=5.88s
    iterations..............................................................: 1113    13.853475/s
    vus.....................................................................: 1       min=1            max=100
    vus_max.................................................................: 100     min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB  22 kB/s
    data_sent...............................................................: 1.1 MB  14 kB/s
```

database 5회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.2s


  █ TOTAL RESULTS

    checks_total.......................: 4492    55.774031/s
    checks_succeeded...................: 100.00% 4492 out of 4492
    checks_failed......................: 0.00%   0 out of 4492

    ✓ register status is 201
    ✓ register has access token
    ✓ coupon issue status is 201
    ✓ coupon issue has userCoupon

    CUSTOM
    coupon_issue_success_rate...............................................: 100.00% 1123 out of 1123

    HTTP
    http_req_duration.......................................................: avg=1.08s min=5.43ms   med=674.23ms max=4.99s p(90)=2.69s p(95)=3.2s
      { expected_response:true }............................................: avg=1.08s min=5.43ms   med=674.23ms max=4.99s p(90)=2.69s p(95)=3.2s
    http_req_failed.........................................................: 0.00%   0 out of 2246
    http_reqs...............................................................: 2246    27.887016/s

    EXECUTION
    iteration_duration......................................................: avg=2.61s min=315.37ms med=1.97s    max=7.07s p(90)=5.3s  p(95)=5.68s
    iterations..............................................................: 1123    13.943508/s
    vus.....................................................................: 1       min=1            max=100
    vus_max.................................................................: 100     min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB  22 kB/s
    data_sent...............................................................: 1.1 MB  14 kB/s
```

## spin

spin 1회차

```
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

spin 2회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=83.77%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=10.51s


  █ TOTAL RESULTS

    checks_total.......................: 4100   50.899705/s
    checks_succeeded...................: 91.90% 3768 out of 4100
    checks_failed......................: 8.09%  332 out of 4100

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  83% — ✓ 857 / ✗ 166
    ✗ coupon issue has userCoupon
      ↳  83% — ✓ 857 / ✗ 166

    CUSTOM
    coupon_issue_errors.....................................................: 166    2.060817/s
    coupon_issue_success_rate...............................................: 83.77% 857 out of 1023

    HTTP
    http_req_duration.......................................................: avg=1.27s    min=6.8ms    med=319.13ms max=11.49s p(90)=3.02s    p(95)=10.51s
      { expected_response:true }............................................: avg=521.27ms min=6.8ms    med=293.89ms max=10s    p(90)=846.71ms p(95)=1.3s
    http_req_failed.........................................................: 8.09%  166 out of 2050
    http_reqs...............................................................: 2050   25.449853/s

    EXECUTION
    iteration_duration......................................................: avg=3.01s    min=306.43ms med=1.13s    max=12.69s p(90)=11.38s   p(95)=11.85s
    iterations..............................................................: 1023   12.700097/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.6 MB 20 kB/s
    data_sent...............................................................: 1.0 MB 13 kB/s
```

spin 3회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=83.26%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=10.53s


  █ TOTAL RESULTS

    checks_total.......................: 4074   50.747927/s
    checks_succeeded...................: 91.65% 3734 out of 4074
    checks_failed......................: 8.34%  340 out of 4074

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  83% — ✓ 846 / ✗ 170
    ✗ coupon issue has userCoupon
      ↳  83% — ✓ 846 / ✗ 170

    CUSTOM
    coupon_issue_errors.....................................................: 170    2.117611/s
    coupon_issue_success_rate...............................................: 83.26% 846 out of 1016

    HTTP
    http_req_duration.......................................................: avg=1.27s   min=7.76ms   med=304.05ms max=11.54s p(90)=2.7s     p(95)=10.53s
      { expected_response:true }............................................: avg=475.1ms min=7.76ms   med=278.18ms max=10.06s p(90)=815.37ms p(95)=1.13s
    http_req_failed.........................................................: 8.34%  170 out of 2037
    http_reqs...............................................................: 2037   25.373964/s

    EXECUTION
    iteration_duration......................................................: avg=3s      min=347.78ms med=1.18s    max=13.04s p(90)=11.38s   p(95)=11.84s
    iterations..............................................................: 1015   12.643384/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.6 MB 20 kB/s
    data_sent...............................................................: 1.0 MB 13 kB/s
```

spin 4회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=82.97%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=10.47s


  █ TOTAL RESULTS

    checks_total.......................: 4092   51.133858/s
    checks_succeeded...................: 91.49% 3744 out of 4092
    checks_failed......................: 8.50%  348 out of 4092

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  82% — ✓ 848 / ✗ 174
    ✗ coupon issue has userCoupon
      ↳  82% — ✓ 848 / ✗ 174

    CUSTOM
    coupon_issue_errors.....................................................: 174    2.174314/s
    coupon_issue_success_rate...............................................: 82.97% 848 out of 1022

    HTTP
    http_req_duration.......................................................: avg=1.31s    min=7.54ms   med=326.49ms max=11.59s p(90)=3.11s    p(95)=10.47s
      { expected_response:true }............................................: avg=485.86ms min=7.54ms   med=303.28ms max=9.23s  p(90)=869.81ms p(95)=1.45s
    http_req_failed.........................................................: 8.50%  174 out of 2046
    http_reqs...............................................................: 2046   25.566929/s

    EXECUTION
    iteration_duration......................................................: avg=3.09s    min=340.31ms med=1.13s    max=12.95s p(90)=11.56s   p(95)=11.91s
    iterations..............................................................: 1022   12.770969/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.6 MB 20 kB/s
    data_sent...............................................................: 1.0 MB 13 kB/s
```

spin 5회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=84.66%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=10.51s


  █ TOTAL RESULTS

    checks_total.......................: 4130   51.408649/s
    checks_succeeded...................: 92.34% 3814 out of 4130
    checks_failed......................: 7.65%  316 out of 4130

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  84% — ✓ 872 / ✗ 158
    ✗ coupon issue has userCoupon
      ↳  84% — ✓ 872 / ✗ 158

    CUSTOM
    coupon_issue_errors.....................................................: 158    1.966723/s
    coupon_issue_success_rate...............................................: 84.66% 872 out of 1030

    HTTP
    http_req_duration.......................................................: avg=1.23s    min=5.52ms   med=348.16ms max=11.51s p(90)=2.14s    p(95)=10.51s
      { expected_response:true }............................................: avg=501.42ms min=5.52ms   med=330.15ms max=9.39s  p(90)=825.88ms p(95)=1.39s
    http_req_failed.........................................................: 7.65%  158 out of 2065
    http_reqs...............................................................: 2065   25.704325/s

    EXECUTION
    iteration_duration......................................................: avg=2.93s    min=310.06ms med=1.18s    max=12.98s p(90)=11.6s    p(95)=11.97s
    iterations..............................................................: 1030   12.821043/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.6 MB 20 kB/s
    data_sent...............................................................: 1.0 MB 13 kB/s
```

## pubsub

pubsub 1회차

```
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

pubsub 2회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=93.39%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=6.06s


  █ TOTAL RESULTS

    checks_total.......................: 4360   54.356353/s
    checks_succeeded...................: 96.69% 4216 out of 4360
    checks_failed......................: 3.30%  144 out of 4360

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  93% — ✓ 1018 / ✗ 72
    ✗ coupon issue has userCoupon
      ↳  93% — ✓ 1018 / ✗ 72

    CUSTOM
    coupon_issue_errors.....................................................: 72     0.897628/s
    coupon_issue_success_rate...............................................: 93.39% 1018 out of 1090

    HTTP
    http_req_duration.......................................................: avg=1.15s    min=5.69ms   med=499.94ms max=10.93s p(90)=2.75s p(95)=6.06s
      { expected_response:true }............................................: avg=943.21ms min=5.69ms   med=489.33ms max=10.02s p(90)=1.71s p(95)=4.46s
    http_req_failed.........................................................: 3.30%  72 out of 2180
    http_reqs...............................................................: 2180   27.178177/s

    EXECUTION
    iteration_duration......................................................: avg=2.76s    min=315.77ms med=1.53s    max=12.51s p(90)=7.24s p(95)=10.18s
    iterations..............................................................: 1090   13.589088/s
    vus.....................................................................: 1      min=1            max=100
    vus_max.................................................................: 100    min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

pubsub 3회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=93.08%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=6.06s


  █ TOTAL RESULTS

    checks_total.......................: 4396   54.813618/s
    checks_succeeded...................: 96.54% 4244 out of 4396
    checks_failed......................: 3.45%  152 out of 4396

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  93% — ✓ 1023 / ✗ 76
    ✗ coupon issue has userCoupon
      ↳  93% — ✓ 1023 / ✗ 76

    CUSTOM
    coupon_issue_errors.....................................................: 76     0.947642/s
    coupon_issue_success_rate...............................................: 93.08% 1023 out of 1099

    HTTP
    http_req_duration.......................................................: avg=1.12s    min=5.9ms    med=498ms    max=11.15s p(90)=1.79s p(95)=6.06s
      { expected_response:true }............................................: avg=896.84ms min=5.9ms    med=487.22ms max=10.71s p(90)=1.45s p(95)=3.75s
    http_req_failed.........................................................: 3.45%  76 out of 2198
    http_reqs...............................................................: 2198   27.406809/s

    EXECUTION
    iteration_duration......................................................: avg=2.69s    min=327.64ms med=1.56s    max=12.65s p(90)=7.39s p(95)=10.53s
    iterations..............................................................: 1099   13.703404/s
    vus.....................................................................: 1      min=1            max=99
    vus_max.................................................................: 100    min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

pubsub 4회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=92.02%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=6.41s


  █ TOTAL RESULTS

    checks_total.......................: 4312   53.674644/s
    checks_succeeded...................: 96.01% 4140 out of 4312
    checks_failed......................: 3.98%  172 out of 4312

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  92% — ✓ 992 / ✗ 86
    ✗ coupon issue has userCoupon
      ↳  92% — ✓ 992 / ✗ 86

    CUSTOM
    coupon_issue_errors.....................................................: 86     1.070505/s
    coupon_issue_success_rate...............................................: 92.02% 992 out of 1078

    HTTP
    http_req_duration.......................................................: avg=1.17s    min=6.81ms   med=537.94ms max=10.91s p(90)=2.56s p(95)=6.41s
      { expected_response:true }............................................: avg=901.66ms min=6.81ms   med=516.67ms max=9.91s  p(90)=1.41s p(95)=4.03s
    http_req_failed.........................................................: 3.98%  86 out of 2156
    http_reqs...............................................................: 2156   26.837322/s

    EXECUTION
    iteration_duration......................................................: avg=2.78s    min=319.97ms med=1.54s    max=12.12s p(90)=7.68s p(95)=11.24s
    iterations..............................................................: 1078   13.418661/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s

```

pubsub 5회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=92.23%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=6.14s


  █ TOTAL RESULTS

    checks_total.......................: 4376   54.681205/s
    checks_succeeded...................: 96.11% 4206 out of 4376
    checks_failed......................: 3.88%  170 out of 4376

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  92% — ✓ 1009 / ✗ 85
    ✗ coupon issue has userCoupon
      ↳  92% — ✓ 1009 / ✗ 85

    CUSTOM
    coupon_issue_errors.....................................................: 85     1.062135/s
    coupon_issue_success_rate...............................................: 92.23% 1009 out of 1094

    HTTP
    http_req_duration.......................................................: avg=1.13s    min=6.9ms    med=511.19ms max=10.95s p(90)=2.07s p(95)=6.14s
      { expected_response:true }............................................: avg=865.11ms min=6.9ms    med=502.18ms max=10.4s  p(90)=1.35s p(95)=3.61s
    http_req_failed.........................................................: 3.88%  85 out of 2188
    http_reqs...............................................................: 2188   27.340602/s

    EXECUTION
    iteration_duration......................................................: avg=2.73s    min=359.76ms med=1.58s    max=12.45s p(90)=7.42s p(95)=11.5s
    iterations..............................................................: 1094   13.670301/s
    vus.....................................................................: 1      min=1            max=100
    vus_max.................................................................: 100    min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

## queue

queue 1회차

```
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

queue 2회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=90.93%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=7.38s


  █ TOTAL RESULTS

    checks_total.......................: 4324   53.995632/s
    checks_succeeded...................: 95.46% 4128 out of 4324
    checks_failed......................: 4.53%  196 out of 4324

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  90% — ✓ 983 / ✗ 98
    ✗ coupon issue has userCoupon
      ↳  90% — ✓ 983 / ✗ 98

    CUSTOM
    coupon_issue_errors.....................................................: 98     1.223768/s
    coupon_issue_success_rate...............................................: 90.93% 983 out of 1081

    HTTP
    http_req_duration.......................................................: avg=1.15s    min=6.16ms   med=492.83ms max=10.96s p(90)=1.68s p(95)=7.38s
      { expected_response:true }............................................: avg=845.88ms min=6.16ms   med=480.46ms max=9.72s  p(90)=1.4s  p(95)=3.75s
    http_req_failed.........................................................: 4.53%  98 out of 2162
    http_reqs...............................................................: 2162   26.997816/s

    EXECUTION
    iteration_duration......................................................: avg=2.76s    min=361.71ms med=1.45s    max=12.89s p(90)=8.39s p(95)=11.29s
    iterations..............................................................: 1081   13.498908/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s
```

queue 3회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=91.44%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=7.08s


  █ TOTAL RESULTS

    checks_total.......................: 4304   53.600397/s
    checks_succeeded...................: 95.72% 4120 out of 4304
    checks_failed......................: 4.27%  184 out of 4304

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  91% — ✓ 984 / ✗ 92
    ✗ coupon issue has userCoupon
      ↳  91% — ✓ 984 / ✗ 92

    CUSTOM
    coupon_issue_errors.....................................................: 92     1.145733/s
    coupon_issue_success_rate...............................................: 91.44% 984 out of 1076

    HTTP
    http_req_duration.......................................................: avg=1.19s    min=7.02ms   med=485.98ms max=11.54s p(90)=2.79s p(95)=7.08s
      { expected_response:true }............................................: avg=854.74ms min=7.02ms   med=469.35ms max=10.23s p(90)=1.49s p(95)=3.76s
    http_req_failed.........................................................: 4.27%  92 out of 2152
    http_reqs...............................................................: 2152   26.800199/s

    EXECUTION
    iteration_duration......................................................: avg=2.84s    min=300.85ms med=1.45s    max=12.58s p(90)=8.22s p(95)=11.47s
    iterations..............................................................: 1076   13.400099/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s
```

qeueue 4회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=90.20%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=7.54s


  █ TOTAL RESULTS

    checks_total.......................: 4328   49.67432/s
    checks_succeeded...................: 95.10% 4116 out of 4328
    checks_failed......................: 4.89%  212 out of 4328

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  90% — ✓ 976 / ✗ 106
    ✗ coupon issue has userCoupon
      ↳  90% — ✓ 976 / ✗ 106

    CUSTOM
    coupon_issue_errors.....................................................: 106    1.216608/s
    coupon_issue_success_rate...............................................: 90.20% 976 out of 1082

    HTTP
    http_req_duration.......................................................: avg=1.17s   min=7.22ms   med=437.64ms max=10.89s p(90)=2.28s p(95)=7.54s
      { expected_response:true }............................................: avg=790.8ms min=7.22ms   med=416.1ms  max=10.02s p(90)=1.27s p(95)=3.57s
    http_req_failed.........................................................: 4.89%  106 out of 2164
    http_reqs...............................................................: 2164   24.83716/s

    EXECUTION
    iteration_duration......................................................: avg=2.79s   min=320.04ms med=1.47s    max=12.91s p(90)=8.74s p(95)=11.31s
    iterations..............................................................: 1082   12.41858/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 19 kB/s
    data_sent...............................................................: 1.1 MB 12 kB/s
```

queue 5회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✓ 'rate>0.8' rate=92.91%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=7.03s


  █ TOTAL RESULTS

    checks_total.......................: 4348   54.188919/s
    checks_succeeded...................: 96.45% 4194 out of 4348
    checks_failed......................: 3.54%  154 out of 4348

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  92% — ✓ 1010 / ✗ 77
    ✗ coupon issue has userCoupon
      ↳  92% — ✓ 1010 / ✗ 77

    CUSTOM
    coupon_issue_errors.....................................................: 77     0.959647/s
    coupon_issue_success_rate...............................................: 92.91% 1010 out of 1087

    HTTP
    http_req_duration.......................................................: avg=1.16s    min=4.95ms   med=526.79ms max=11.47s p(90)=1.94s p(95)=7.03s
      { expected_response:true }............................................: avg=885.61ms min=4.95ms   med=509.65ms max=9.63s  p(90)=1.46s p(95)=3.18s
    http_req_failed.........................................................: 3.54%  77 out of 2174
    http_reqs...............................................................: 2174   27.09446/s

    EXECUTION
    iteration_duration......................................................: avg=2.77s    min=324.86ms med=1.55s    max=13.12s p(90)=7.89s p(95)=11.34s
    iterations..............................................................: 1086   13.534767/s
    vus.....................................................................: 1      min=1            max=99
    vus_max.................................................................: 100    min=100          max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s
```

## fencing

fencing 1회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=37.20%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=5.63s


  █ TOTAL RESULTS

    checks_total.......................: 4236   52.775543/s
    checks_succeeded...................: 68.60% 2906 out of 4236
    checks_failed......................: 31.39% 1330 out of 4236

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  37% — ✓ 394 / ✗ 665
    ✗ coupon issue has userCoupon
      ↳  37% — ✓ 394 / ✗ 665

    CUSTOM
    coupon_issue_errors.....................................................: 665    8.285112/s
    coupon_issue_success_rate...............................................: 37.20% 394 out of 1059

    HTTP
    http_req_duration.......................................................: avg=1.23s    min=6.47ms   med=613.22ms max=11.83s p(90)=1.84s p(95)=5.63s
      { expected_response:true }............................................: avg=694.83ms min=6.47ms   med=489.44ms max=4.71s  p(90)=1.58s p(95)=1.78s
    http_req_failed.........................................................: 31.39% 665 out of 2118
    http_reqs...............................................................: 2118   26.387771/s

    EXECUTION
    iteration_duration......................................................: avg=2.92s    min=295.99ms med=1.76s    max=13.75s p(90)=7.4s  p(95)=11.01s
    iterations..............................................................: 1059   13.193886/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 21 kB/s
    data_sent...............................................................: 1.1 MB 13 kB/s
```

fencing 2회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=36.75%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=5.48s


  █ TOTAL RESULTS

    checks_total.......................: 4440   55.430806/s
    checks_succeeded...................: 68.37% 3036 out of 4440
    checks_failed......................: 31.62% 1404 out of 4440

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  36% — ✓ 408 / ✗ 702
    ✗ coupon issue has userCoupon
      ↳  36% — ✓ 408 / ✗ 702

    CUSTOM
    coupon_issue_errors.....................................................: 702    8.76406/s
    coupon_issue_success_rate...............................................: 36.75% 408 out of 1110

    HTTP
    http_req_duration.......................................................: avg=1.13s    min=6.11ms   med=532.31ms max=11.61s p(90)=2.01s p(95)=5.48s
      { expected_response:true }............................................: avg=538.28ms min=6.11ms   med=432.5ms  max=1.86s  p(90)=1.14s p(95)=1.2s
    http_req_failed.........................................................: 31.62% 702 out of 2220
    http_reqs...............................................................: 2220   27.715403/s

    EXECUTION
    iteration_duration......................................................: avg=2.71s    min=415.61ms med=1.75s    max=12.6s  p(90)=6.79s p(95)=10.05s
    iterations..............................................................: 1110   13.857702/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

fencing 3회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=34.33%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=5.19s


  █ TOTAL RESULTS

    checks_total.......................: 4392   54.837707/s
    checks_succeeded...................: 67.16% 2950 out of 4392
    checks_failed......................: 32.83% 1442 out of 4392

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  34% — ✓ 377 / ✗ 721
    ✗ coupon issue has userCoupon
      ↳  34% — ✓ 377 / ✗ 721

    CUSTOM
    coupon_issue_errors.....................................................: 721    9.002274/s
    coupon_issue_success_rate...............................................: 34.33% 377 out of 1098

    HTTP
    http_req_duration.......................................................: avg=1.13s    min=6.79ms  med=558.3ms  max=11.41s p(90)=1.86s p(95)=5.19s
      { expected_response:true }............................................: avg=574.25ms min=6.79ms  med=476.98ms max=1.74s  p(90)=1.22s p(95)=1.35s
    http_req_failed.........................................................: 32.83% 721 out of 2196
    http_reqs...............................................................: 2196   27.418854/s

    EXECUTION
    iteration_duration......................................................: avg=2.72s    min=324.5ms med=1.73s    max=13.22s p(90)=6.48s p(95)=9.64s
    iterations..............................................................: 1098   13.709427/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.7 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

fencing 4회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=35.63%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=5.79s


  █ TOTAL RESULTS

    checks_total.......................: 4176   51.878316/s
    checks_succeeded...................: 67.81% 2832 out of 4176
    checks_failed......................: 32.18% 1344 out of 4176

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  35% — ✓ 372 / ✗ 672
    ✗ coupon issue has userCoupon
      ↳  35% — ✓ 372 / ✗ 672

    CUSTOM
    coupon_issue_errors.....................................................: 672    8.348235/s
    coupon_issue_success_rate...............................................: 35.63% 372 out of 1044

    HTTP
    http_req_duration.......................................................: avg=1.23s   min=5.34ms   med=540.1ms  max=11.71s p(90)=2.03s p(95)=5.79s
      { expected_response:true }............................................: avg=610.9ms min=5.34ms   med=474.08ms max=2.31s  p(90)=1.44s p(95)=1.62s
    http_req_failed.........................................................: 32.18% 672 out of 2088
    http_reqs...............................................................: 2088   25.939158/s

    EXECUTION
    iteration_duration......................................................: avg=2.92s   min=328.93ms med=1.66s    max=13.36s p(90)=8.09s p(95)=11.59s
    iterations..............................................................: 1044   12.969579/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.6 MB 20 kB/s
    data_sent...............................................................: 1.0 MB 13 kB/s
```

fencing 5회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=37.34%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.84s


  █ TOTAL RESULTS

    checks_total.......................: 4488   55.913406/s
    checks_succeeded...................: 68.67% 3082 out of 4488
    checks_failed......................: 31.32% 1406 out of 4488

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  37% — ✓ 419 / ✗ 703
    ✗ coupon issue has userCoupon
      ↳  37% — ✓ 419 / ✗ 703

    CUSTOM
    coupon_issue_errors.....................................................: 703    8.758272/s
    coupon_issue_success_rate...............................................: 37.34% 419 out of 1122

    HTTP
    http_req_duration.......................................................: avg=1.09s    min=5.21ms   med=629.11ms max=11.56s p(90)=1.75s p(95)=3.84s
      { expected_response:true }............................................: avg=642.84ms min=5.21ms   med=494.67ms max=2.11s  p(90)=1.46s p(95)=1.65s
    http_req_failed.........................................................: 31.32% 703 out of 2244
    http_reqs...............................................................: 2244   27.956703/s

    EXECUTION
    iteration_duration......................................................: avg=2.63s    min=339.09ms med=1.88s    max=13.34s p(90)=5.38s p(95)=8.75s
    iterations..............................................................: 1122   13.978352/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.8 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

## redlock

redlock 1회차

```
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

redlock 2회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=69.25%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.65s


  █ TOTAL RESULTS

    checks_total.......................: 4488   55.796025/s
    checks_succeeded...................: 84.62% 3798 out of 4488
    checks_failed......................: 15.37% 690 out of 4488

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  69% — ✓ 777 / ✗ 345
    ✗ coupon issue has userCoupon
      ↳  69% — ✓ 777 / ✗ 345

    CUSTOM
    coupon_issue_errors.....................................................: 345    4.289133/s
    coupon_issue_success_rate...............................................: 69.25% 777 out of 1122

    HTTP
    http_req_duration.......................................................: avg=1.09s    min=5.02ms   med=634.3ms  max=5.55s p(90)=2.93s p(95)=3.65s
      { expected_response:true }............................................: avg=733.68ms min=5.02ms   med=472.03ms max=4.53s p(90)=1.63s p(95)=2.3s
    http_req_failed.........................................................: 15.37% 345 out of 2244
    http_reqs...............................................................: 2244   27.898012/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s    min=309.04ms med=2s       max=9.27s p(90)=5.33s p(95)=5.7s
    iterations..............................................................: 1122   13.949006/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.8 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

redlock 3회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=69.67%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.62s


  █ TOTAL RESULTS

    checks_total.......................: 4472   55.805417/s
    checks_succeeded...................: 84.83% 3794 out of 4472
    checks_failed......................: 15.16% 678 out of 4472

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  69% — ✓ 779 / ✗ 339
    ✗ coupon issue has userCoupon
      ↳  69% — ✓ 779 / ✗ 339

    CUSTOM
    coupon_issue_errors.....................................................: 339    4.23033/s
    coupon_issue_success_rate...............................................: 69.67% 779 out of 1118

    HTTP
    http_req_duration.......................................................: avg=1.09s    min=5.41ms   med=592.82ms max=4.91s p(90)=2.94s p(95)=3.62s
      { expected_response:true }............................................: avg=738.41ms min=5.41ms   med=439.96ms max=4.9s  p(90)=1.79s p(95)=2.41s
    http_req_failed.........................................................: 15.16% 339 out of 2236
    http_reqs...............................................................: 2236   27.902708/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s    min=291.26ms med=2.13s    max=8.41s p(90)=5.52s p(95)=5.96s
    iterations..............................................................: 1118   13.951354/s
    vus.....................................................................: 1      min=1           max=99
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.8 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

redlock 4회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=69.23%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.61s


  █ TOTAL RESULTS

    checks_total.......................: 4460   55.623899/s
    checks_succeeded...................: 84.61% 3774 out of 4460
    checks_failed......................: 15.38% 686 out of 4460

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  69% — ✓ 772 / ✗ 343
    ✗ coupon issue has userCoupon
      ↳  69% — ✓ 772 / ✗ 343

    CUSTOM
    coupon_issue_errors.....................................................: 343    4.277802/s
    coupon_issue_success_rate...............................................: 69.23% 772 out of 1115

    HTTP
    http_req_duration.......................................................: avg=1.09s    min=6.16ms   med=604.59ms max=5.35s p(90)=3.16s p(95)=3.61s
      { expected_response:true }............................................: avg=714.08ms min=6.16ms   med=458.46ms max=4.71s p(90)=1.7s  p(95)=2.06s
    http_req_failed.........................................................: 15.38% 343 out of 2230
    http_reqs...............................................................: 2230   27.811949/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s    min=344.75ms med=2.01s    max=7.43s p(90)=5.41s p(95)=5.97s
    iterations..............................................................: 1115   13.905975/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.8 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```

redlock 5회차

```
  █ THRESHOLDS

    coupon_issue_success_rate
    ✗ 'rate>0.8' rate=65.26%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.71s


  █ TOTAL RESULTS

    checks_total.......................: 4468   55.336248/s
    checks_succeeded...................: 82.63% 3692 out of 4468
    checks_failed......................: 17.36% 776 out of 4468

    ✓ register status is 201
    ✓ register has access token
    ✗ coupon issue status is 201
      ↳  65% — ✓ 729 / ✗ 388
    ✗ coupon issue has userCoupon
      ↳  65% — ✓ 729 / ✗ 388

    CUSTOM
    coupon_issue_errors.....................................................: 388    4.805386/s
    coupon_issue_success_rate...............................................: 65.26% 729 out of 1117

    HTTP
    http_req_duration.......................................................: avg=1.09s    min=6.24ms   med=583.8ms  max=5.6s  p(90)=3.09s p(95)=3.71s
      { expected_response:true }............................................: avg=677.64ms min=6.24ms   med=445.67ms max=4.69s p(90)=1.46s p(95)=2.02s
    http_req_failed.........................................................: 17.36% 388 out of 2234
    http_reqs...............................................................: 2234   27.668124/s

    EXECUTION
    iteration_duration......................................................: avg=2.64s    min=332.24ms med=2.07s    max=7.75s p(90)=5.32s p(95)=5.79s
    iterations..............................................................: 1117   13.834062/s
    vus.....................................................................: 1      min=1           max=100
    vus_max.................................................................: 100    min=100         max=100

    NETWORK
    data_received...........................................................: 1.8 MB 22 kB/s
    data_sent...............................................................: 1.1 MB 14 kB/s
```
