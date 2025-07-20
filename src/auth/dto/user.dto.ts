import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
  @ApiProperty({
    example: "user-123",
    description: "사용자 ID",
  })
  id: string;

  @ApiProperty({
    example: "user@example.com",
    description: "사용자 이메일",
  })
  email: string;

  @ApiProperty({
    example: "홍길동",
    description: "사용자 이름",
  })
  name: string;

  @ApiProperty({
    example: "2024-01-01T00:00:00.000Z",
    description: "생성 일시",
  })
  createdAt: Date;

  @ApiProperty({
    example: "2024-01-01T00:00:00.000Z",
    description: "수정 일시",
  })
  updatedAt: Date;
}
