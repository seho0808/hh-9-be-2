import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("토큰이 필요합니다");
    }

    try {
      // JWT 토큰 검증 로직 (Mock)
      // 실제로는 JWT 라이브러리를 사용해서 토큰을 검증해야 함
      const payload = this.validateToken(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다");
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  private validateToken(token: string) {
    // Mock 토큰 검증 - 실제로는 JWT 라이브러리 사용
    if (token === "mock-jwt-token") {
      return {
        id: "user-123",
        email: "user@example.com",
        name: "홍길동",
      };
    }
    throw new Error("Invalid token");
  }
}
