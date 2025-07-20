# 📘 API 엔드포인트

## 👤 사용자

- `GET /api/users/me` – 내 정보 조회
- `POST /api/users` – 회원가입
- `POST /api/auth/login` – 로그인
- `POST /api/auth/logout` – 로그아웃

## 💰 포인트 / 잔액

- `GET /api/users/me/points/balance` – 내 잔액 조회
- `POST /api/users/me/points/charges` – 포인트 충전
- `GET /api/users/me/points/transactions` – 포인트 거래 내역 조회

## 🛍️ 상품

- `GET /api/products` – 전체 상품 조회
- `GET /api/products/popular` – 인기 상품 조회
- `GET /api/products/:productId` – 단일 상품 조회

## 🎟️ 쿠폰

- `GET /api/coupons` – 사용 가능 쿠폰 목록
- `GET /api/coupons/:couponId` – 쿠폰 상세 조회
- `POST /api/coupons/:couponId/claims` – 쿠폰 발급 요청 (선착순)
- `GET /api/users/me/coupons` – 내가 가진 쿠폰 목록

## 🧾 주문 / 결제

- `POST /api/orders` – 주문 생성 및 결제
- `GET /api/orders/:orderId` – 주문 상세 조회
- `GET /api/users/me/orders` – 내 주문 목록
