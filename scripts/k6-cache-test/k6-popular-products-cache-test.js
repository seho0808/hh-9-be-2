import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://[::1]:3000";
const CACHE_ENABLED = __ENV.CACHE_ENABLED !== "false"; // 기본값은 true

const cacheHitRate = new Rate("cache_hit_rate");
const cacheMissCount = new Counter("cache_miss_count");
const dbQueryCount = new Counter("db_query_count");
const cacheResponseTime = new Trend("cache_response_time");

export const options = {
  scenarios: {
    cache_test: {
      executor: "ramping-vus",
      stages: [
        { duration: "2s", target: 20 }, // 웜업 (캐시 워밍업)
        { duration: "3s", target: 50 }, // 안정기 (반복 요청으로 캐시 효과 측정)
        { duration: "2s", target: 0 }, // 종료
      ],
      gracefulRampDown: "2s",
    },
  },
  thresholds: {
    http_req_duration: CACHE_ENABLED ? ["p(95)<200"] : ["p(95)<1000"], // 캐시 활성화 시 더 엄격한 임계값
    cache_hit_rate: CACHE_ENABLED ? ["rate>0.9"] : ["rate==0"], // 캐시 활성화 시 90% 이상, 비활성화 시 0%
    http_req_failed: ["rate<0.01"], // 1% 미만 에러율
  },
};

function getPopularProducts() {
  const startTime = new Date().getTime();

  const headers = {
    Accept: "application/json",
  };

  // 캐시 비활성화 옵션
  if (!CACHE_ENABLED) {
    headers["X-Cache-Disabled"] = "true";
  }

  const response = http.get(`${BASE_URL}/api/products/popular`, {
    headers: headers,
  });

  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;
  cacheResponseTime.add(responseTime);

  const isSuccess = check(response, {
    "status is 200": (r) => r.status === 200,
    "has popular products data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch {
        return false;
      }
    },
  });

  if (isSuccess) {
    // 캐시 활성화 상태에 따른 성능 측정
    let isCacheHit = false;

    if (CACHE_ENABLED) {
      // 캐시 활성화 시: 응답 헤더 확인 또는 응답 시간으로 판단
      const cacheStatus = response.headers["X-Cache-Status"];
      if (cacheStatus) {
        isCacheHit = cacheStatus === "HIT";
      } else {
        // 헤더가 없으면 응답 시간으로 추정 (100ms 미만이면 캐시 히트)
        isCacheHit = responseTime < 100;
      }
    } else {
      // 캐시 비활성화 시: 항상 캐시 미스
      isCacheHit = false;
    }

    cacheHitRate.add(isCacheHit);

    if (!isCacheHit) {
      cacheMissCount.add(1);
      dbQueryCount.add(1);
    }

    // 응답에서 메타데이터 추출
    try {
      const body = JSON.parse(response.body);
      if (body.meta) {
        // 캐시 정보가 응답에 포함된 경우
        if (body.meta.fromCache === false) {
          dbQueryCount.add(1);
        }
        // 데이터베이스 쿼리 시간도 기록
        if (body.meta.dbQueryTime) {
          console.log(`DB Query Time: ${body.meta.dbQueryTime}ms`);
        }
      }
    } catch {
      // 파싱 실패 시 무시
    }
  }

  return isSuccess;
}

export default function () {
  // 동일한 엔드포인트를 반복 호출하여 캐시 효과 극대화
  for (let i = 0; i < 3; i++) {
    getPopularProducts();
    sleep(0.1); // 짧은 간격으로 반복 요청
  }

  // 짧은 대기 시간으로 캐시 효과에 집중
  sleep(Math.random() * 0.2 + 0.1);
}

export function setup() {
  console.log(`Starting Popular Products Cache Test against ${BASE_URL}`);
  console.log(`Cache Enabled: ${CACHE_ENABLED}`);
  console.log(
    "Testing cache hit rate and response times for popular products endpoint"
  );

  // 캐시가 활성화된 경우에만 워밍업
  if (CACHE_ENABLED) {
    console.log("Warming up cache with 5 requests...");
    for (let i = 0; i < 5; i++) {
      http.get(`${BASE_URL}/api/products/popular`);
      sleep(0.2);
    }
    console.log("Cache warmed up - ready to measure cache hits");
  } else {
    console.log("Cache disabled - measuring database performance baseline");
  }

  return {
    baseUrl: BASE_URL,
    testType: "popular-products-cache",
    cacheEnabled: CACHE_ENABLED,
  };
}

export function teardown(data) {
  console.log("Popular Products Cache Test completed");
  console.log(`Test configuration: ${JSON.stringify(data)}`);

  // 테스트 후 통계 출력
  console.log("Cache performance metrics will be available in the K6 results");
}
