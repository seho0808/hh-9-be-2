import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://[::1]:3000";
const CACHE_ENABLED = __ENV.CACHE_ENABLED !== "false"; // 기본값은 true

const cacheHitRate = new Rate("user_orders_cache_hit_rate");
const cacheMissCount = new Counter("user_orders_cache_miss_count");
const dbQueryCount = new Counter("user_orders_db_query_count");
const cacheResponseTime = new Trend("user_orders_cache_response_time");

export const options = {
  scenarios: {
    user_orders_cache_test: {
      executor: "ramping-vus",
      stages: [
        { duration: "2s", target: 6 }, // 웜업 (사용자당 2VU로 시작)
        { duration: "3s", target: 12 }, // 안정기 (사용자당 4VU로 반복 요청)
        { duration: "2s", target: 0 }, // 종료
      ],
      gracefulRampDown: "2s",
    },
  },
  thresholds: {
    http_req_duration: CACHE_ENABLED ? ["p(95)<200"] : ["p(95)<1000"], // 캐시 활성화 시 더 엄격한 임계값
    user_orders_cache_hit_rate: CACHE_ENABLED ? ["rate>0.75"] : ["rate==0"], // 캐시 활성화 시 75% 이상 (워밍업 고려)
    http_req_failed: ["rate<0.01"], // 1% 미만 에러율
  },
};

// 시드된 테스트 사용자들 (기존 캐시 데이터 활용)
const TEST_USERS = [];

// 시드된 사용자 정보
const SEEDED_TEST_USERS = [
  {
    email: "cacheuser1@cachetest.example.com",
    password: "testpassword123", // 실제 테스트용 비밀번호
    userId: "cache-test-user-1",
  },
  {
    email: "cacheuser2@cachetest.example.com",
    password: "testpassword123",
    userId: "cache-test-user-2",
  },
  {
    email: "cacheuser3@cachetest.example.com",
    password: "testpassword123",
    userId: "cache-test-user-3",
  },
];

function loginTestUser(userIndex) {
  const userData = SEEDED_TEST_USERS[userIndex];
  if (!userData) return null;

  const loginPayload = JSON.stringify({
    email: userData.email,
    password: userData.password,
  });

  const response = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      return body.data.accessToken;
    } catch {
      return null;
    }
  }
  return null;
}

function getUserOrders(accessToken) {
  const startTime = new Date().getTime();

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  // 캐시 비활성화 옵션
  if (!CACHE_ENABLED) {
    headers["X-Cache-Disabled"] = "true";
  }

  const response = http.get(`${BASE_URL}/api/users/me/orders`, {
    headers: headers,
  });

  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;
  cacheResponseTime.add(responseTime);

  const isSuccess = check(response, {
    "status is 200": (r) => r.status === 200,
    "has orders data": (r) => {
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
        // 헤더가 없으면 응답 시간으로 추정 (150ms 미만이면 캐시 히트)
        isCacheHit = responseTime < 150;
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

export default function () {
  const vuId = __VU;
  const iteration = __ITER;

  // 시드된 사용자들을 순환하며 사용 (3명의 사용자를 모든 VU가 공유)
  const userIndex = (vuId - 1) % SEEDED_TEST_USERS.length;
  let accessToken = TEST_USERS[userIndex];

  if (!accessToken) {
    // 해당 사용자의 토큰이 없으면 로그인
    accessToken = loginTestUser(userIndex);
    if (accessToken) {
      TEST_USERS[userIndex] = accessToken;
    } else {
      console.error(`Failed to login user ${userIndex}`);
      return; // 로그인 실패 시 스킵
    }
  }

  // 캐시 워밍업을 위한 첫 번째 요청 (캐시 미스 예상)
  if (iteration === 0) {
    getUserOrders(accessToken);
    sleep(0.5); // 캐시가 저장될 시간 대기
  }

  // 동일 사용자의 주문 이력을 연속으로 여러 번 조회하여 캐시 효과 극대화
  for (let i = 0; i < 5; i++) {
    getUserOrders(accessToken);
    sleep(0.1); // 매우 짧은 간격으로 반복 조회
  }

  // 짧은 대기 시간으로 캐시 효과에 집중
  sleep(Math.random() * 0.2 + 0.1);
}

export function setup() {
  console.log(`Starting User Orders Cache Test against ${BASE_URL}`);
  console.log(`Cache Enabled: ${CACHE_ENABLED}`);
  console.log("Testing cache hit rate for user-specific order history");
  console.log(
    `Using ${SEEDED_TEST_USERS.length} pre-seeded test users for consistent cache testing`
  );

  // 캐시가 활성화된 경우에만 워밍업
  if (CACHE_ENABLED) {
    console.log("Warming up user orders cache...");

    // 각 테스트 사용자의 캐시를 워밍업
    for (let i = 0; i < SEEDED_TEST_USERS.length; i++) {
      const accessToken = loginTestUser(i);
      if (accessToken) {
        // 첫 번째 요청으로 캐시 생성
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        };

        http.get(`${BASE_URL}/api/users/me/orders`, { headers });
        sleep(0.2); // 캐시 저장 시간 대기

        console.log(`Warmed up cache for user ${i + 1}`);
      }
    }

    console.log("Cache warm-up completed - ready to measure cache hits");
  } else {
    console.log("Cache disabled - measuring database performance baseline");
  }

  return {
    baseUrl: BASE_URL,
    testType: "user-orders-cache",
    cacheEnabled: CACHE_ENABLED,
    testUsers: SEEDED_TEST_USERS.length,
  };
}

export function teardown(data) {
  console.log("User Orders Cache Test completed");
  console.log(`Test configuration: ${JSON.stringify(data)}`);

  console.log(
    "User-specific cache performance metrics available in K6 results"
  );
}
