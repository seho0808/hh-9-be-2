import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthJwtService {
  private readonly expiresIn = 3600;

  constructor(private readonly jwtService: JwtService) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: this.expiresIn,
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      const decoded = this.jwtService.verify(token);

      // 필수 필드 검증
      if (!decoded.id || !decoded.email || !decoded.name) {
        throw new Error("Invalid token payload");
      }

      return {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
      };
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Token expired");
      }
      throw new Error("Invalid token");
    }
  }

  getTokenExpiresIn(): number {
    return this.expiresIn;
  }
}
