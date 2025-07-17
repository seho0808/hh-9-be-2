import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { LoginDto } from "../dto/login.dto";
import { RegisterDto } from "../dto/register.dto";
import { LoginResponseDto, UserInfoDto } from "../dto/auth-response.dto";

@Injectable()
export class AuthMockService {
  // Mock 사용자 데이터베이스
  private mockUsers = [
    {
      id: "user-123",
      email: "user@example.com",
      password: "password123",
      name: "홍길동",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    {
      id: "admin-456",
      email: "admin@example.com",
      password: "admin123",
      name: "관리자",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  ];

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    // 사용자 찾기
    const user = this.mockUsers.find((u) => u.email === email);
    if (!user) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 잘못되었습니다");
    }

    // 비밀번호 확인
    if (user.password !== password) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 잘못되었습니다");
    }

    // JWT 토큰 생성 (Mock)
    const accessToken = "mock-jwt-token";

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<UserInfoDto> {
    const { email, password, name } = registerDto;

    // 이메일 중복 확인
    const existingUser = this.mockUsers.find((u) => u.email === email);
    if (existingUser) {
      throw new ConflictException("이미 존재하는 이메일입니다");
    }

    // 새 사용자 생성
    const newUser = {
      id: `user-${Date.now()}`,
      email,
      password,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mockUsers.push(newUser);

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  }

  async getCurrentUser(userId: string): Promise<UserInfoDto> {
    const user = this.mockUsers.find((u) => u.id === userId);
    if (!user) {
      throw new UnauthorizedException("사용자를 찾을 수 없습니다");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
