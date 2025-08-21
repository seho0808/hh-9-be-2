import Redis from "ioredis";

/**
 * Redis EVALSHA 기능을 제공하는 기본 클래스
 */
export abstract class BaseRedisEvalsha {
  private readonly scriptSHAs: Map<string, string> = new Map();

  /**
   * 구현체에서 Redis 클라이언트를 제공해야 함
   */
  protected abstract getRedisClient(): Redis;

  /**
   * EVALSHA를 사용하여 스크립트 실행
   * 스크립트가 Redis에 없으면 자동으로 로드 후 재시도
   */
  async evalsha(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<any> {
    let sha = this.scriptSHAs.get(script);

    // SHA가 없으면 스크립트를 로드
    if (!sha) {
      sha = await this.loadScript(script);
    }

    try {
      return await this.getRedisClient().evalsha(sha, numKeys, ...args);
    } catch (error: any) {
      // NOSCRIPT 에러가 발생하면 스크립트를 다시 로드하고 재시도
      if (error.message && error.message.includes("NOSCRIPT")) {
        sha = await this.loadScript(script);
        return await this.getRedisClient().evalsha(sha, numKeys, ...args);
      }
      throw error;
    }
  }

  /**
   * Lua 스크립트를 Redis에 로드하고 SHA 해시 반환
   * EVALSHA 사용을 위한 스크립트 캐싱
   */
  private async loadScript(script: string): Promise<string> {
    // 이미 캐시된 SHA가 있다면 바로 반환
    if (this.scriptSHAs.has(script)) {
      return this.scriptSHAs.get(script)!;
    }

    try {
      // Redis에 스크립트 로드 (Redis가 자동으로 SHA1 해시 생성 후 반환)
      const sha = (await this.getRedisClient().script(
        "LOAD",
        script
      )) as string;
      this.scriptSHAs.set(script, sha);
      return sha;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 스크립트 캐시 정리 (필요시 사용)
   */
  clearScriptCache(): void {
    this.scriptSHAs.clear();
  }
}
