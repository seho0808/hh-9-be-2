export abstract class InfrastructureError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class OptimisticLockError extends InfrastructureError {
  readonly code = "OPTIMISTIC_LOCK_ERROR";

  constructor(id: string, expectedVersion: number, actualVersion?: number) {
    super(
      `엔티티 ${id}에 대한 낙관적 잠금 실패. 기대 버전: ${expectedVersion}, 실제 버전: ${actualVersion}`
    );
  }
}

export class SpinLockTimeoutError extends InfrastructureError {
  readonly code = "SPIN_LOCK_TIMEOUT";

  constructor(lockKey: string, error: string) {
    super(`스핀락 타임아웃 (키: ${lockKey}): ${error}`);
  }
}
