import { ApiProperty } from "@nestjs/swagger";

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
