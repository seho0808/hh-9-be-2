import { OptimisticLockError } from "@/common/exceptions/infrastructure.exceptions";

/**
 * OptimisticLockError 발생 시 메서드를 재시도하는 데코레이터
 * 전체 비즈니스 로직을 처음부터 다시 실행한다.
 */
export function RetryOnOptimisticLock(
  maxRetries: number = 3,
  baseDelayMs: number = 50
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await method.apply(this, args);
        } catch (error) {
          // OptimisticLockError가 아니거나 마지막 시도인 경우 에러를 다시 던짐
          if (
            !(error instanceof OptimisticLockError) ||
            attempt === maxRetries
          ) {
            throw error;
          }

          // 지수 백오프로 잠시 대기
          const delayMs =
            Math.pow(2, attempt) * baseDelayMs + Math.random() * baseDelayMs;
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          console.log(
            `OptimisticLockError 발생. 재시도 ${attempt + 1}/${maxRetries}: ${error.message}`
          );
        }
      }
    };

    return descriptor;
  };
}
