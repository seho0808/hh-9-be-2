export interface LockOptions {
  ttl?: number;
  timeout?: number;
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
}

export interface LockService {
  /**
   * 락을 획득하고 함수를 실행합니다
   * @param lockKey 락 키
   * @param fn 실행할 함수
   * @param options 락 옵션
   */
  withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T>;
}
