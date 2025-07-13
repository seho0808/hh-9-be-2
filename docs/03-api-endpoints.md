# API 엔드포인트

## 잔액 충전, 조회

- 충전: POST /api/points/charge
- 조회: GET /api/points

인증으로 누구인지 식별

## 상품 조회

- 상품 조회: GET /api/products
- 단일 상품 조회: GET /api/products/:id

## 선착순 쿠폰 기능

- 쿠폰 발급: POST /api/coupons
- 보유 쿠폰 조회: GET /api/coupons

## 주문 / 결제 API

- 결제: POST /api/orders

## 상위 상품 조회 API

- 상위 상품 조회: GET /api/products/popular
