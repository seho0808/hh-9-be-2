import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { UserResponseDto } from "../dto/user.dto";
import { RegisterDto } from "../../auth/dto/register.dto";

@Injectable()
export class UserMockService {
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

  async createUser(createUserDto: RegisterDto): Promise<UserResponseDto> {
    const { email, password, name } = createUserDto;

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

  async findUserById(userId: string): Promise<UserResponseDto> {
    const user = this.mockUsers.find((u) => u.id === userId);
    if (!user) {
      throw new NotFoundException("사용자를 찾을 수 없습니다");
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
