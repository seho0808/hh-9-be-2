import { OptimisticLockError } from "@/common/exceptions/infrastructure.exceptions";
import { AsyncLocalStorage } from "async_hooks";

/**
 * OptimisticLockError 발생 시 메서드를 재시도하는 데코레이터
 * 전체 비즈니스 로직을 처음부터 다시 실행한다.
 *
 * 상위 스택에서 이미 RetryOnOptimisticLock 컨텍스트가 활성화되어 있는 경우
 * (즉, 더 바깥쪽에서 재시도 루프를 수행 중인 경우) 이 데코레이터는
 * 재시도 루프를 중복 실행하지 않고 메서드를 단순 호출만 수행한다.
 *
 * 컨텍스트 전파를 위해 Node.js AsyncLocalStorage를 사용한다.
 */
const retryContext = new AsyncLocalStorage<boolean>();

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
      // 이미 상위에서 재시도 컨텍스트가 활성화되어 있으면 재시도 없이 실행
      if (retryContext.getStore()) {
        return await method.apply(this, args);
      }

      // 최초 진입: 컨텍스트를 설정하고 재시도 루프 수행
      return await retryContext.run(true, async () => {
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
      });
    };

    return descriptor;
  };
}
