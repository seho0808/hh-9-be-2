import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { UserDto } from "./user.dto";

export class LoginDto {
  @ApiProperty({
    example: "user@example.com",
    description: "사용자 이메일",
  })
  @IsEmail({}, { message: "유효한 이메일 형식이어야 합니다" })
  @IsNotEmpty({ message: "이메일은 필수입니다" })
  email: string;

  @ApiProperty({
    example: "password123",
    description: "사용자 비밀번호",
    minLength: 6,
  })
  @IsString({ message: "비밀번호는 문자열이어야 합니다" })
  @IsNotEmpty({ message: "비밀번호는 필수입니다" })
  @MinLength(6, { message: "비밀번호는 최소 6자 이상이어야 합니다" })
  password: string;
}
export class LoginResponseDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT 액세스 토큰",
  })
  accessToken: string;

  @ApiProperty({
    example: "Bearer",
    description: "토큰 타입",
  })
  tokenType: string;

  @ApiProperty({
    example: 3600,
    description: "토큰 만료 시간 (초)",
  })
  expiresIn: number;

  @ApiProperty({
    description: "사용자 정보",
    type: () => UserDto,
  })
  user: UserDto;
}
