import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

function randomUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const BASE_URL = "http://[::1]:3000";
const PRODUCT_ID = "cache-test-product-1"; // 단일 인기 상품
const CHARGE_AMOUNT = Number(100000); // 충분한 충전 금액

export const options = {
  scenarios: {
    peak_discovery: {
      executor: "ramping-arrival-rate",
      preAllocatedVUs: 100,
      maxVUs: 2000,
      timeUnit: "1s",
      stages: [
        { duration: "10s", target: 6 },
        { duration: "10s", target: 8 },
        { duration: "10s", target: 10 },
        { duration: "10s", target: 12 },
        { duration: "10s", target: 14 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800"],
    order_success: ["rate>0.98"],
  },
};

const registerOk = new Rate("register_ok");
const chargeOk = new Rate("charge_ok");
const orderOk = new Rate("order_success");
const orderDuration = new Trend("order_duration");

function registerUser() {
  const ts = Date.now();
  const email = `ord${__VU}_${__ITER}_${ts}@test.example.com`;
  const payload = JSON.stringify({
    email,
    password: "@password123",
    name: `OrderUser_${__VU}_${__ITER}`,
    idempotencyKey: `reg_${email}_${ts}`,
  });
  const res = http.post(`${BASE_URL}/api/auth/signup`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  const ok = check(res, { "register 201": (r) => r.status === 201 });
  registerOk.add(ok);
  if (!ok) return null;
  try {
    const body = JSON.parse(res.body);
    return body.data?.accessToken || null;
  } catch {
    return null;
  }
}

function charge(token) {
  const payload = JSON.stringify({
    amount: CHARGE_AMOUNT,
    idempotencyKey: randomUUID(),
  });
  const res = http.post(`${BASE_URL}/api/users/me/points/charges`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(res.body);
  const ok = check(res, {
    "charge 200/201": (r) => r.status === 200 || r.status === 201,
  });
  chargeOk.add(ok);
  return ok;
}

function placeOrder(token) {
  const start = Date.now();
  const payload = JSON.stringify({
    idempotencyKey: randomUUID(),
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
  });
  const res = http.post(`${BASE_URL}/api/orders`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const ok = check(res, {
    "order 200/201": (r) => r.status === 200 || r.status === 201,
  });
  orderOk.add(ok);
  orderDuration.add(Date.now() - start);
  return ok;
}

export default function () {
  const token = registerUser();
  if (!token) {
    sleep(0.2);
    return;
  }
  if (!charge(token)) {
    sleep(0.2);
    return;
  }
  placeOrder(token);
  sleep(Math.random() * 0.2 + 0.1);
}
