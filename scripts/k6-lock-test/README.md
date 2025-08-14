# 쿠폰 발급을 위한 K6 부하 테스트

이 디렉토리는 다양한 잠금 전략을 사용한 쿠폰 발급 성능 테스트를 위한 K6 부하 테스트 스크립트와 유틸리티를 포함합니다.

## <1> 사전 요구사항

1. **k6 설치**: https://k6.io/docs/getting-started/installation/
2. **데이터베이스 설정**: MySQL과 Redis가 실행 중인지 확인 (docker-compose up -d)
3. **애플리케이션**: NestJS 애플리케이션 빌드 후 시작 (`npm run start`)

## <2> 빠른 시작

0. **예시 전체 플로우**:

   ```shell
   # process 1
   pnpm i
   pnpm run build
   pnpm run start

   # process 2
   docker-compose up -d
   pnpm run seed:coupon
   pnpm run k6:coupon:database
   pnpm run cleanup:test-data
   ```

1. **테스트 데이터 시드**:

   ```bash
   pnpm run seed:coupon
   ```

2. **다양한 잠금 전략으로 부하 테스트 실행**:

   ```bash
   # 데이터베이스 잠금 (기본값)
   pnpm run k6:coupon:database

   # 스핀 잠금
   pnpm run k6:coupon:spinlock

   # PubSub 잠금
   pnpm run k6:coupon:pubsub

   # 큐 잠금
   pnpm run k6:coupon:queue

   # 펜싱 잠금
   pnpm run k6:coupon:fencing

   # Redlock
   pnpm run k6:coupon:redlock
   ```

3. **테스트 후 정리**:
   ```bash
   npm run cleanup:test-data
   ```

## <3> 테스트 설정

K6 스크립트는 다음 프로필로 **스파이크 테스트**를 위해 구성되어 있습니다:

- **램프 업**: 10초 동안 20명 사용자
- **스파이크**: 30초 동안 100명 사용자
- **스케일 다운**: 10초 동안 20명 사용자
- **램프 다운**: 30초 동안 0명 사용자

## <4> 테스트 메트릭

스크립트는 다음을 추적합니다:

- **HTTP 요청 지속 시간** (p95 < 2000ms 임계값)
- **쿠폰 발급 성공률** (>80% 임계값)
- **사용자 정의 오류 카운터** (실패한 쿠폰 발급용)

## <5> 시딩

- ID가 `test-coupon-1`인 테스트 쿠폰 생성
- 부하 테스트를 위한 높은 용량 (10,000개 쿠폰)
- 7일 유효 기간
