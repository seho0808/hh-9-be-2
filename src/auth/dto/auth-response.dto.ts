import { ApiProperty } from "@nestjs/swagger";

export class UserInfoDto {
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

export class LoginResponseDto {
  @ApiProperty({ description: "JWT 토큰" })
  accessToken: string;

  @ApiProperty({ description: "토큰 타입", default: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "토큰 만료 시간 (초)", example: 3600 })
  expiresIn: number;

  @ApiProperty({ description: "사용자 정보" })
  user: UserInfoDto;
}
