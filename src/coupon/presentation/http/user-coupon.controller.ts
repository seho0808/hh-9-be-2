import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "@/common/decorators/current-user.decorator";
import { ApiResponseDto } from "@/common/dto/response.dto";
import { Controller, Get, UseGuards, UseFilters } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UserCouponResponseDto } from "./dto/coupon.dto";
import { CouponExceptionFilter } from "./filters/coupon-exception.filter";
import { GetAllUserCouponsUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/get-all-user-couponse.use-case";

@ApiTags("사용자 쿠폰")
@Controller("users/me/coupons")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(CouponExceptionFilter)
export class UserCouponController {
  constructor(
    private readonly getAllUserCouponsUseCase: GetAllUserCouponsUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: "내가 가진 쿠폰 목록" })
  @ApiResponse({
    status: 200,
    description: "보유 쿠폰 조회 성공",
    type: [UserCouponResponseDto],
  })
  async getMyCoupons(
    @CurrentUser() user: CurrentUserData
  ): Promise<ApiResponseDto<UserCouponResponseDto[]>> {
    const result = await this.getAllUserCouponsUseCase.execute({
      userId: user.id,
    });
    return ApiResponseDto.success(
      result.userCoupons.map(UserCouponResponseDto.fromEntity),
      "보유 쿠폰 목록을 조회했습니다"
    );
  }
}
