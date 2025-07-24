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
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class BalanceResponseDto {
  @ApiProperty({ description: "사용자 ID" })
  userId: string;

  @ApiProperty({ description: "현재 잔액 (원)" })
  balance: number;

  @ApiProperty({ description: "마지막 업데이트 시간" })
  updatedAt: Date;

  static fromUserBalance(userBalance: UserBalance): BalanceResponseDto {
    const props = userBalance.toPersistence();
    return {
      userId: props.userId,
      balance: props.balance,
      updatedAt: props.updatedAt,
    };
  }
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

  static fromPointTransaction(
    userBalance: UserBalance,
    pointTransaction: PointTransaction
  ): ChargeResponseDto {
    const props = pointTransaction.toPersistence();
    const userBalanceProps = userBalance.toPersistence();
    return {
      amount: props.amount,
      newBalance: userBalanceProps.balance,
      transactionId: props.id,
      chargedAt: props.createdAt,
    };
  }
}

export enum TransactionType {
  CHARGE = "CHARGE",
  USE = "USE",
  RECOVER = "RECOVER",
}
