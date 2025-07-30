import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import {
  ChargeBalanceDto,
  BalanceResponseDto,
  ChargeResponseDto,
} from "./dto/wallet.dto";
import { ApiResponseDto } from "../../../common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../../../common/decorators/current-user.decorator";
import { WalletExceptionFilter } from "./filters/wallet-exception.filter";
import { v4 as uuidv4 } from "uuid";
import { GetUserPointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/get-user-points.use-case";
import { ChargePointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/charge-points.use-case";

@ApiTags("포인트/잔액")
@Controller("users/me/points")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(WalletExceptionFilter)
export class WalletController {
  constructor(
    private readonly getUserPointsUseCase: GetUserPointsUseCase,
    private readonly chargePointsUseCase: ChargePointsUseCase
  ) {}

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
    const result = await this.getUserPointsUseCase.execute({ userId: user.id });
    return ApiResponseDto.success(
      BalanceResponseDto.fromEntity(result.userBalance),
      "잔액을 성공적으로 조회했습니다"
    );
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
    const result = await this.chargePointsUseCase.execute({
      userId: user.id,
      amount: chargeDto.amount,
      idempotencyKey: chargeDto.idempotencyKey ?? uuidv4(),
    });
    return ApiResponseDto.success(
      ChargeResponseDto.fromEntity(result.userBalance, result.pointTransaction),
      "포인트 충전이 완료되었습니다"
    );
  }
}
