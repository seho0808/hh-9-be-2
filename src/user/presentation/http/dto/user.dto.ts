import { User } from "@/user/domain/entities/user.entity";
import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty({
    description: "사용자 ID",
    example: "user-123",
  })
  id: string;

  @ApiProperty({
    description: "이메일",
    example: "user@example.com",
  })
  email: string;

  @ApiProperty({
    description: "사용자 이름",
    example: "홍길동",
  })
  name: string;

  @ApiProperty({
    description: "생성일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "수정일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
