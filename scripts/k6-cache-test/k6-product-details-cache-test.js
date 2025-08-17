import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://[::1]:3000";
const CACHE_ENABLED = __ENV.CACHE_ENABLED !== "false"; // 기본값은 true

const cacheHitRate = new Rate("product_details_cache_hit_rate");
const cacheMissCount = new Counter("product_details_cache_miss_count");
const dbQueryCount = new Counter("product_details_db_query_count");
const cacheResponseTime = new Trend("product_details_cache_response_time");

export const options = {
  scenarios: {
    product_details_cache_test: {
      executor: "ramping-vus",
      stages: [
        { duration: "2s", target: 15 }, // 웜업 (적은 상품에 집중)
        { duration: "3s", target: 40 }, // 안정기 (동일 상품 반복 요청)
        { duration: "2s", target: 0 }, // 종료
      ],
      gracefulRampDown: "2s",
    },
  },
  thresholds: {
    http_req_duration: CACHE_ENABLED ? ["p(95)<150"] : ["p(95)<800"], // 캐시 활성화 시 더 엄격한 임계값
    product_details_cache_hit_rate: CACHE_ENABLED ? ["rate>0.9"] : ["rate==0"], // 캐시 활성화 시 90% 이상
    http_req_failed: ["rate<0.01"], // 1% 미만 에러율
  },
};

// 테스트용 인기 상품 ID들 (실제로는 setup에서 가져옴)
let POPULAR_PRODUCT_IDS = [];

function getProductDetails(productId) {
  const startTime = new Date().getTime();

  const headers = {
    Accept: "application/json",
  };

  // 캐시 비활성화 옵션
  if (!CACHE_ENABLED) {
    headers["X-Cache-Disabled"] = "true";
  }

  const response = http.get(`${BASE_URL}/api/products/${productId}`, {
    headers: headers,
  });

  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;
  cacheResponseTime.add(responseTime);

  const isSuccess = check(response, {
    "status is 200": (r) => r.status === 200,
    "has product data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id === productId;
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
        // Cache-Aside 패턴: 100ms 미만이면 캐시 히트로 추정
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
      if (body.meta && body.meta.fromCache === false) {
        dbQueryCount.add(1);
      }
    } catch {
      // 파싱 실패 시 무시
    }
  }

  return isSuccess;
}

function getRandomProductId() {
  if (POPULAR_PRODUCT_IDS.length === 0) {
    // 기본 상품 ID들 (캐시 테스트에 집중)
    return `cache-test-product-${Math.floor(Math.random() * 3) + 1}`;
  }

  // 캐시 효과 극대화를 위해 상위 3개 상품에만 집중 (95/5 분배)
  const random = Math.random();
  if (random < 0.95) {
    // 95%의 요청은 상위 3개 상품에 집중 (캐시 히트 극대화)
    const topProductsCount = Math.min(3, POPULAR_PRODUCT_IDS.length);
    const index = Math.floor(Math.random() * topProductsCount);
    return POPULAR_PRODUCT_IDS[index];
  } else {
    // 5%의 요청만 나머지 상품들에 분산 (캐시 미스 시뮬레이션)
    const index = Math.floor(Math.random() * POPULAR_PRODUCT_IDS.length);
    return POPULAR_PRODUCT_IDS[index];
  }
}

export default function () {
  const productId = getRandomProductId();

  // 동일 상품을 여러 번 조회하여 캐시 효과 극대화
  for (let i = 0; i < 4; i++) {
    getProductDetails(productId);
    sleep(0.05); // 매우 짧은 간격으로 반복 요청
  }

  // 짧은 대기 시간으로 캐시 효과에 집중
  sleep(Math.random() * 0.1 + 0.05);
}

export function setup() {
  console.log(`Starting Product Details Cache Test against ${BASE_URL}`);
  console.log(`Cache Enabled: ${CACHE_ENABLED}`);
  console.log("Testing Cache-Aside pattern for product details");

  // 인기 상품 목록 가져오기 (캐시 상태와 관계없이)
  try {
    const response = http.get(`${BASE_URL}/api/products/popular`);
    if (response.status === 200) {
      const body = JSON.parse(response.body);
      if (body.data && Array.isArray(body.data)) {
        POPULAR_PRODUCT_IDS = body.data.map((p) => p.id);
        console.log(
          `Found ${POPULAR_PRODUCT_IDS.length} popular products for testing`
        );
      }
    }
  } catch (error) {
    console.warn("Failed to fetch popular products, using default product IDs");
  }

  // 캐시 테스트에 최적화된 상품 ID들로 폴백 (적은 수로 캐시 효과 극대화)
  if (POPULAR_PRODUCT_IDS.length === 0) {
    POPULAR_PRODUCT_IDS = [
      "cache-test-product-1",
      "cache-test-product-2",
      "cache-test-product-3",
      "cache-test-product-4",
      "cache-test-product-5",
    ];
    console.log("Using fallback product IDs optimized for cache testing");
  }

  console.log(
    `Testing with product IDs: ${POPULAR_PRODUCT_IDS.slice(0, 5).join(", ")}...`
  );

  return {
    baseUrl: BASE_URL,
    testType: "product-details-cache",
    productIds: POPULAR_PRODUCT_IDS,
    cacheEnabled: CACHE_ENABLED,
  };
}

export function teardown(data) {
  console.log("Product Details Cache Test completed");
  console.log(
    `Test configuration: ${JSON.stringify({
      baseUrl: data.baseUrl,
      testType: data.testType,
      productCount: data.productIds.length,
    })}`
  );

  console.log(
    "Cache-Aside pattern performance metrics available in K6 results"
  );
}
