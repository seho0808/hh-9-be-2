import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from "class-validator";
import { UserDto } from "./user.dto";

export class RegisterDto {
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

  @ApiProperty({
    example: "홍길동",
    description: "사용자 이름",
  })
  @IsString({ message: "이름은 문자열이어야 합니다" })
  @IsNotEmpty({ message: "이름은 필수입니다" })
  @MinLength(2, { message: "이름은 최소 2자 이상이어야 합니다" })
  @MaxLength(50, { message: "이름은 최대 50자까지 가능합니다" })
  name: string;
}

export class RegisterResponseDto extends UserDto {}
