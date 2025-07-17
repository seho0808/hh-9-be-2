import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    description: "이메일",
    example: "user@example.com",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "비밀번호",
    example: "password123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: "사용자 이름",
    example: "홍길동",
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;
}

export class UserResponseDto {
  @ApiProperty({ description: "사용자 ID" })
  id: string;

  @ApiProperty({ description: "이메일" })
  email: string;

  @ApiProperty({ description: "사용자 이름" })
  name: string;

  @ApiProperty({ description: "생성일시" })
  createdAt: Date;

  @ApiProperty({ description: "수정일시" })
  updatedAt: Date;
}
