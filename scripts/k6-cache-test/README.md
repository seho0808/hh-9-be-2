# Redis 캐싱 성능 비교 테스트 (K6 부하 테스트)

이 디렉토리는 **캐시 활성화 vs 비활성화 성능 비교**에 최적화된 K6 부하 테스트 스크립트를 포함합니다.
최소한의 데이터로 동일 엔티티에 반복 요청하여 캐시 효과를 명확히 측정할 수 있습니다.

## <1> 테스트 대상 캐시

### 1.1 인기 상품 통계 (Popular Products)

- **캐시 키**: `popular:products:top10`
- **TTL**: 30분
- **갱신 전략**: 5분마다 백그라운드 갱신
- **무효화**: 주문 완료 시

### 1.2 사용자별 주문 이력 (User Order History)

- **캐시 키**: `user:orders:{userId}`
- **TTL**: 10분
- **갱신 전략**: 새 주문 생성 시 즉시 무효화
- **무효화**: 주문 상태 변경 시

### 1.3 상품 상세 정보 (Product Details)

- **캐시 키**: `product:details:{productId}`
- **TTL**: 1시간
- **갱신 전략**: Cache-Aside 패턴
- **무효화**: 상품 수정 시

## <2> 사전 요구사항

1. **k6 설치**: https://k6.io/docs/getting-started/installation/
2. **데이터베이스 설정**: MySQL과 Redis가 실행 중인지 확인 (docker-compose up -d)
3. **애플리케이션**: NestJS 애플리케이션 빌드 후 시작 (`npm run start`)

## <3> 빠른 시작

0. **캐시 성능 비교 테스트 전체 플로우**:

   ```shell
   # process 1: 애플리케이션 시작
   pnpm i
   pnpm run build
   pnpm run start

   # process 2: 테스트 데이터 생성 및 캐시 성능 비교
   docker-compose up -d
   pnpm run seed:cache-test-data  # 최소 데이터 생성 (상품 5개, 사용자 3개, 주문 15개)

   # 캐시 성능 비교 테스트 (동일 조건에서 캐시 활성화/비활성화 비교)
   pnpm run k6:cache:popular-products:disabled  # 기준선: 캐시 비활성화
   pnpm run k6:cache:popular-products           # 비교군: 캐시 활성화

   pnpm run cleanup:cache-test-data
   ```

1. **테스트 데이터 시드**:

   ```bash
   pnpm run seed:cache-test-data
   ```

2. **캐시 성능 테스트 실행**:

   ```bash
   # 인기 상품 통계 캐시 테스트
   pnpm run k6:cache:popular-products          # 캐시 활성화
   pnpm run k6:cache:popular-products:disabled # 캐시 비활성화 (비교용)

   # 사용자 주문 이력 캐시 테스트
   pnpm run k6:cache:user-orders               # 캐시 활성화
   pnpm run k6:cache:user-orders:disabled      # 캐시 비활성화 (비교용)

   # 상품 상세 정보 캐시 테스트
   pnpm run k6:cache:product-details           # 캐시 활성화
   pnpm run k6:cache:product-details:disabled  # 캐시 비활성화 (비교용)
   ```

3. **캐시 상태 확인 및 정리**:

   ```bash
   # 캐시 통계 확인
   pnpm run cache:stats

   # 캐시만 삭제
   pnpm run cleanup:cache-test-data:cache

   # 전체 테스트 데이터 정리
   pnpm run cleanup:cache-test-data
   ```

## <4> 캐시 성능 비교 최적화 전략

### 4.1 테스트 데이터 최적화

- **상품**: 5개 (최소한의 데이터로 캐시 효과 극대화)
- **사용자**: 3개 (사용자별 캐시 테스트용)
- **주문**: 15개 (인기 상품 위주 집중 배치)

### 4.2 반복 요청 패턴

- **인기 상품**: 동일 엔드포인트를 연속 3회 호출 → 캐시 히트율 90% 이상 목표
- **상품 상세**: 상위 3개 상품에 95% 집중 → 4회 연속 조회로 캐시 효과 극대화
- **사용자 주문**: 동일 사용자 5회 연속 조회 → 사용자별 캐시 성능 측정

### 4.3 성능 비교 시나리오

#### A. 캐시 비활성화 (기준선)

- **응답 시간**: p95 < 1000ms
- **캐시 히트율**: 0%
- **DB 쿼리**: 모든 요청이 DB 조회

#### B. 캐시 활성화 (비교군)

- **응답 시간**: p95 < 200ms (80% 이상 개선 목표)
- **캐시 히트율**: 90% 이상
- **DB 쿼리**: 90% 감소 목표
