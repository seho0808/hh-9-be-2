import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min, Max, IsOptional, IsEnum } from "class-validator";
import { Type } from "class-transformer";

export class ChargeBalanceDto {
  @ApiProperty({
    description: "충전할 금액 (원)",
    example: 10000,
    minimum: 1000,
    maximum: 100000,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1000, { message: "최소 충전 금액은 1,000원입니다" })
  @Max(100000, { message: "1회 최대 충전 금액은 100,000원입니다" })
  amount: number;
}

export class BalanceResponseDto {
  @ApiProperty({ description: "사용자 ID" })
  userId: string;

  @ApiProperty({ description: "현재 잔액 (원)" })
  balance: number;

  @ApiProperty({ description: "마지막 업데이트 시간" })
  updatedAt: Date;
}

export class ChargeResponseDto {
  @ApiProperty({ description: "충전 금액 (원)" })
  amount: number;

  @ApiProperty({ description: "충전 후 잔액 (원)" })
  newBalance: number;

  @ApiProperty({ description: "거래 ID" })
  transactionId: string;

  @ApiProperty({ description: "충전 완료 시간" })
  chargedAt: Date;
}

export enum TransactionType {
  CHARGE = "CHARGE",
  DEDUCT = "DEDUCT",
  REFUND = "REFUND",
}

export class TransactionResponseDto {
  @ApiProperty({ description: "거래 ID" })
  id: string;

  @ApiProperty({ description: "사용자 ID" })
  userId: string;

  @ApiProperty({
    description: "거래 타입",
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({ description: "거래 금액 (원)" })
  amount: number;

  @ApiProperty({ description: "거래 후 잔액 (원)" })
  balanceAfter: number;

  @ApiProperty({ description: "거래 사유", required: false })
  reason?: string;

  @ApiProperty({ description: "참조 ID (주문 ID 등)", required: false })
  referenceId?: string;

  @ApiProperty({ description: "거래 시간" })
  createdAt: Date;
}

export class TransactionQueryDto {
  @ApiProperty({
    description: "거래 타입 필터",
    enum: TransactionType,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: "페이지 번호",
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: "페이지당 항목 수",
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
