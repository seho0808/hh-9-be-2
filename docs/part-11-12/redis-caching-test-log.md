### popular-products

캐시 있음

```
  █ THRESHOLDS

    cache_hit_rate
    ✓ 'rate>0.9' rate=100.00%

    http_req_duration
    ✓ 'p(95)<200' p(95)=3.13ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%
```

캐시 없음

```
  █ THRESHOLDS

    cache_hit_rate
    ✓ 'rate==0' rate=0.00%

    http_req_duration
    ✓ 'p(95)<1000' p(95)=7.25ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%
```

### product-details

캐시 있음

```
  █ THRESHOLDS

    http_req_duration
    ✓ 'p(95)<150' p(95)=3.72ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%

    product_details_cache_hit_rate
    ✓ 'rate>0.9' rate=100.00%
```

캐시 없음

```
  █ THRESHOLDS

    http_req_duration
    ✓ 'p(95)<800' p(95)=9.3ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%

    product_details_cache_hit_rate
    ✓ 'rate==0' rate=0.00%

```

### user-orders

캐시 있음

```
  █ THRESHOLDS

    http_req_duration
    ✓ 'p(95)<200' p(95)=59.09ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%

    user_orders_cache_hit_rate
    ✓ 'rate>0.75' rate=100.00%
```

캐시 없음

```
  █ THRESHOLDS

    http_req_duration
    ✓ 'p(95)<1000' p(95)=56.58ms

    http_req_failed
    ✓ 'rate<0.01' rate=0.00%

    user_orders_cache_hit_rate
    ✓ 'rate==0' rate=0.00%
```
