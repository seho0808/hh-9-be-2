import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { WalletMockService } from "./services/wallet.mock.service";
import {
  ChargeBalanceDto,
  BalanceResponseDto,
  ChargeResponseDto,
  TransactionResponseDto,
  TransactionQueryDto,
} from "./dto/wallet.dto";
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from "../common/dto/response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";

@ApiTags("포인트/잔액")
@Controller("users/me/points")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
export class WalletController {
  constructor(private readonly walletService: WalletMockService) {}

  @Get("balance")
  @ApiOperation({ summary: "내 잔액 조회" })
  @ApiResponse({
    status: 200,
    description: "잔액 조회 성공",
    type: BalanceResponseDto,
  })
  async getBalance(
    @CurrentUser() user: CurrentUserData
  ): Promise<ApiResponseDto<BalanceResponseDto>> {
    const result = await this.walletService.getUserBalance(user.id);
    return ApiResponseDto.success(result, "잔액을 성공적으로 조회했습니다");
  }

  @Post("charges")
  @ApiOperation({ summary: "포인트 충전" })
  @ApiResponse({
    status: 201,
    description: "충전 성공",
    type: ChargeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "잘못된 충전 금액",
  })
  async chargeBalance(
    @CurrentUser() user: CurrentUserData,
    @Body() chargeDto: ChargeBalanceDto
  ): Promise<ApiResponseDto<ChargeResponseDto>> {
    const result = await this.walletService.chargeBalance(user.id, chargeDto);
    return ApiResponseDto.success(result, "포인트 충전이 완료되었습니다");
  }

  @Get("transactions")
  @ApiOperation({ summary: "포인트 거래 내역 조회" })
  @ApiResponse({
    status: 200,
    description: "거래 내역 조회 성공",
    type: PaginatedResponseDto<TransactionResponseDto>,
  })
  async getTransactionHistory(
    @CurrentUser() user: CurrentUserData,
    @Query() query: TransactionQueryDto
  ): Promise<ApiResponseDto<PaginatedResponseDto<TransactionResponseDto>>> {
    const result = await this.walletService.getTransactionHistory(
      user.id,
      query
    );
    return ApiResponseDto.success(
      result,
      "거래 내역을 성공적으로 조회했습니다"
    );
  }
}
