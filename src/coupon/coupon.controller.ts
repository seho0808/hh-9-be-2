import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { CouponMockService } from "./services/coupon.mock.service";
import {
  CouponResponseDto,
  UserCouponResponseDto,
  ClaimCouponDto,
  CouponQueryDto,
} from "./dto/coupon.dto";
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from "../common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";

@ApiTags("쿠폰")
@Controller("coupons")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
export class CouponController {
  constructor(private readonly couponService: CouponMockService) {}

  @Get()
  @ApiOperation({ summary: "사용 가능 쿠폰 목록" })
  @ApiResponse({
    status: 200,
    description: "쿠폰 목록 조회 성공",
    type: PaginatedResponseDto<CouponResponseDto>,
  })
  async getAvailableCoupons(
    @Query() query: CouponQueryDto
  ): Promise<ApiResponseDto<PaginatedResponseDto<CouponResponseDto>>> {
    const result = await this.couponService.getAvailableCoupons(query);
    return ApiResponseDto.success(
      result,
      "사용 가능한 쿠폰 목록을 조회했습니다"
    );
  }

  @Get(":couponId")
  @ApiOperation({ summary: "쿠폰 상세 조회" })
  @ApiParam({
    name: "couponId",
    description: "쿠폰 ID",
    example: "coupon-1",
  })
  @ApiResponse({
    status: 200,
    description: "쿠폰 조회 성공",
    type: CouponResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "쿠폰을 찾을 수 없음",
  })
  async getCouponById(
    @Param("couponId") couponId: string
  ): Promise<ApiResponseDto<CouponResponseDto>> {
    const result = await this.couponService.getCouponById(couponId);
    return ApiResponseDto.success(result, "쿠폰 정보를 조회했습니다");
  }

  @Post(":couponId/claims")
  @ApiOperation({ summary: "쿠폰 발급 요청 (선착순)" })
  @ApiParam({
    name: "couponId",
    description: "쿠폰 ID",
    example: "coupon-1",
  })
  @ApiResponse({
    status: 201,
    description: "쿠폰 발급 성공",
    type: UserCouponResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "쿠폰 발급 실패 (소진, 유효하지 않음 등)",
  })
  @ApiResponse({
    status: 409,
    description: "이미 발급받은 쿠폰",
  })
  async claimCoupon(
    @CurrentUser() user: CurrentUserData,
    @Param("couponId") couponId: string,
    @Body() claimDto: ClaimCouponDto
  ): Promise<ApiResponseDto<UserCouponResponseDto>> {
    const result = await this.couponService.claimCoupon(
      user.id,
      couponId,
      claimDto
    );
    return ApiResponseDto.success(result, "쿠폰이 성공적으로 발급되었습니다");
  }
}

@ApiTags("사용자 쿠폰")
@Controller("users/me/coupons")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
export class UserCouponController {
  constructor(private readonly couponService: CouponMockService) {}

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
    const result = await this.couponService.getUserCoupons(user.id);
    return ApiResponseDto.success(result, "보유 쿠폰 목록을 조회했습니다");
  }
}
