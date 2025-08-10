import { ApiProperty } from "@nestjs/swagger";

export class ApiResponseDto<T> {
  @ApiProperty({ description: "성공 여부" })
  success: boolean;

  @ApiProperty({ description: "응답 메시지" })
  message: string;

  @ApiProperty({ description: "응답 데이터" })
  data?: T;

  @ApiProperty({ description: "에러 코드", required: false })
  errorCode?: string;

  constructor(success: boolean, message: string, data?: T, errorCode?: string) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.errorCode = errorCode;
  }

  static success<T>(data?: T, message: string = "성공"): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data);
  }

  static error(message: string, errorCode?: string): ApiResponseDto<null> {
    return new ApiResponseDto(false, message, null, errorCode);
  }
}

export class PaginationDto {
  @ApiProperty({ description: "페이지 번호", default: 1, minimum: 1 })
  page: number = 1;

  @ApiProperty({
    description: "페이지당 항목 수",
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  limit: number = 10;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: "데이터 목록" })
  items: T[];

  @ApiProperty({ description: "전체 항목 수" })
  total: number;

  @ApiProperty({ description: "현재 페이지" })
  page: number;

  @ApiProperty({ description: "페이지당 항목 수" })
  limit: number;

  @ApiProperty({ description: "전체 페이지 수" })
  totalPages: number;

  @ApiProperty({ description: "다음 페이지 존재 여부" })
  hasNext: boolean;

  @ApiProperty({ description: "이전 페이지 존재 여부" })
  hasPrev: boolean;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}
