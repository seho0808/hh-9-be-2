export class DataPlatformHttpException extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = "DataPlatformHttpException";
  }
}

export class DataPlatformTimeoutException extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "DataPlatformTimeoutException";
  }
}

export class DataPlatformNetworkException extends Error {
  public readonly originalError?: unknown;
  constructor(originalError?: unknown) {
    super("Network error while calling data platform");
    this.name = "DataPlatformNetworkException";
    this.originalError = originalError;
  }
}
