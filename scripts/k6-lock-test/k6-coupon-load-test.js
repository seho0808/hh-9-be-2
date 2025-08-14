import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

const couponIssueErrors = new Counter("coupon_issue_errors");
const couponIssueSuccessRate = new Rate("coupon_issue_success_rate");

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

const BASE_URL = __ENV.BASE_URL || "http://[::1]:3000";
const LOCK_STRATEGY = __ENV.LOCK_STRATEGY || "database";
const COUPON_ID = __ENV.COUPON_ID || "test-coupon-1";

function generateTestUser(vuId, iteration) {
  const timestamp = Date.now();
  return {
    email: `k6user${vuId}_${iteration}_${timestamp}@test.example.com`,
    password: "@password123",
    name: `K6TestUser${vuId}_${iteration}`,
  };
}

function registerUser(userData) {
  const registerPayload = JSON.stringify({
    email: userData.email,
    password: userData.password,
    name: userData.name,
    idempotencyKey: `register_${userData.email}_${Date.now()}`,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = http.post(
    `${BASE_URL}/api/auth/signup`,
    registerPayload,
    params
  );

  const registerSuccess = check(response, {
    "register status is 201": (r) => r.status === 201,
    "register has access token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.accessToken;
      } catch {
        return false;
      }
    },
  });

  if (!registerSuccess) {
    console.error(
      `Registration failed for ${userData.email}: ${response.status} ${response.body}`
    );
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    return body.data.accessToken;
  } catch {
    console.error(
      `Failed to parse registration response for ${userData.email}`
    );
    return null;
  }
}

function issueCoupon(accessToken, couponId, lockStrategy) {
  const issuePayload = JSON.stringify({
    couponCode: "K6LOADTEST",
    idempotencyKey: `issue_${accessToken.substr(0, 10)}_${Date.now()}`,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Lock-Strategy": lockStrategy,
    },
  };

  const response = http.post(
    `${BASE_URL}/api/coupons/${couponId}/claims`,
    issuePayload,
    params
  );

  const issueSuccess = check(response, {
    "coupon issue status is 201": (r) => r.status === 201,
    "coupon issue has userCoupon": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id;
      } catch {
        return false;
      }
    },
  });

  couponIssueSuccessRate.add(issueSuccess);

  if (!issueSuccess) {
    couponIssueErrors.add(1);
    console.warn(`Coupon issue failed: ${response.status} ${response.body}`);
  }

  return issueSuccess;
}

export default function () {
  const vuId = __VU;
  const iteration = __ITER;
  const userData = generateTestUser(vuId, iteration);
  const accessToken = registerUser(userData);
  if (!accessToken) return;

  sleep(Math.random() * 0.5 + 0.1);
  issueCoupon(accessToken, COUPON_ID, LOCK_STRATEGY);
  sleep(0.1);
}

export function setup() {
  console.log(`Starting K6 load test against ${BASE_URL}`);
  console.log(`Lock strategy: ${LOCK_STRATEGY}`);
  console.log(`Coupon ID: ${COUPON_ID}`);

  return {
    baseUrl: BASE_URL,
    lockStrategy: LOCK_STRATEGY,
    couponId: COUPON_ID,
  };
}

export function teardown(data) {
  console.log("K6 load test completed");
  console.log(`Test configuration: ${JSON.stringify(data)}`);
}
