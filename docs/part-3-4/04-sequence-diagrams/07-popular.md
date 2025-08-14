# 인기 상품 조회

## 7-1. [정상] 최근 3일 기준 인기 상품 조회

엔드포인트: `GET /api/products/popular`

```mermaid
sequenceDiagram
    participant Client
    participant API_Server
    participant AuthService
    participant ProductService
    participant Database

    Client->>API_Server: GET /api/products/popular
    API_Server->>AuthService: verifyToken()
    AuthService-->>API_Server: userId

    API_Server->>ProductService: getPopularProducts()
    ProductService->>Database: 집계 정보 주세요
    Database-->>ProductService: 인기 상품 5개

    ProductService-->>API_Server: 상품 목록
    API_Server-->>Client: 200 OK { products: [...] }
```

### 특징

- 단순 조회로, 실패 시나리오는 생략 가능
- 최근 3일 주문 기준 상위 5개 상품 조회
- 구현은 postgres면 materialized view, mysql이면 집계 테이블 정도로 하면 될듯..?
