import { ApiProperty } from "@nestjs/swagger";

export class StandardErrorResponseDto {
  @ApiProperty({ description: "성공 여부", example: false })
  success = false as const;

  @ApiProperty({ description: "HTTP 상태 코드", example: 400 })
  statusCode: number;

  @ApiProperty({
    description: "에러 메시지",
    example: "사용자를 찾을 수 없습니다",
  })
  message: string;

  @ApiProperty({ description: "에러 코드", example: "USER_NOT_FOUND" })
  code: string;

  @ApiProperty({
    description: "타임스탬프",
    example: "2024-01-15T10:30:00.000Z",
  })
  timestamp: string;

  @ApiProperty({ description: "예외 타입", example: "UserNotFoundError" })
  error: string;

  @ApiProperty({
    description: "요청 ID",
    example: "req-abc-123",
    required: false,
  })
  correlationId?: string;

  @ApiProperty({ description: "상세 정보", required: false })
  details?: any;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    error: string,
    correlationId?: string,
    details?: any
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.code = code;
    this.error = error;
    this.timestamp = new Date().toISOString();
    this.correlationId = correlationId || `req-${Date.now()}`;
    this.details = details;
  }
}
