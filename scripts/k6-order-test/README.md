## 사전준비

```shell
docker-compose up -d
pnpm i
pnpm run build
pnpm run start
```

## Run

```bash
# 재고 세팅 (기본: cache-test-product-1 을 총재고 1,000,000 으로)
DB_HOST=localhost DB_PORT=3306 DB_USERNAME=root DB_PASSWORD=root DB_DATABASE=testdb \
  pnpm ts-node scripts/k6-order-test/seed-order-test-data.ts

# 단일 인기 상품 주문: 빠른 램핑 ARR (가입→충전→주문)
k6 run scripts/k6-order-test/k6-popular-product-order-test.js

# 테스트 사용자/주문/포인트 데이터 정리 (본 스크립트로 생성된 계정)
DB_HOST=localhost DB_PORT=3306 DB_USERNAME=root DB_PASSWORD=root DB_DATABASE=testdb \
  pnpm ts-node scripts/k6-order-test/cleanup-order-test-data.ts
```
