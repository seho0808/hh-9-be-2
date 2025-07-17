import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
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
}
