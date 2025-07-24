import { ApiProperty } from "@nestjs/swagger";
import {
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsEnum,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { PointTransaction } from "@/wallet/domain/entities/point-transaction.entity";

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

  @ApiProperty({
    description: "거래 고유 키",
    example: "charge_user123_20240115_001",
    required: false,
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class BalanceResponseDto {
  @ApiProperty({
    description: "사용자 ID",
    example: "user-123",
  })
  userId: string;

  @ApiProperty({
    description: "현재 잔액 (원)",
    example: 50000,
  })
  balance: number;

  @ApiProperty({
    description: "마지막 업데이트 시간",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;

  static fromEntity(userBalance: UserBalance): BalanceResponseDto {
    const props = userBalance.toPersistence();
    return {
      userId: props.userId,
      balance: props.balance,
      updatedAt: props.updatedAt,
    };
  }
}

export class ChargeResponseDto {
  @ApiProperty({
    description: "거래 ID",
    example: "txn-123e4567-e89b-12d3",
  })
  transactionId: string;

  @ApiProperty({
    description: "충전 금액 (원)",
    example: 10000,
  })
  amount: number;

  @ApiProperty({
    description: "충전 후 잔액 (원)",
    example: 60000,
  })
  newBalance: number;

  @ApiProperty({
    description: "충전 완료 시간",
    example: "2024-01-15T10:30:00.000Z",
  })
  chargedAt: Date;

  static fromEntity(
    userBalance: UserBalance,
    pointTransaction: PointTransaction
  ): ChargeResponseDto {
    const props = pointTransaction.toPersistence();
    const userBalanceProps = userBalance.toPersistence();
    return {
      transactionId: props.id,
      amount: props.amount,
      newBalance: userBalanceProps.balance,
      chargedAt: props.createdAt,
    };
  }
}

export enum TransactionType {
  CHARGE = "CHARGE",
  USE = "USE",
  RECOVER = "RECOVER",
}
