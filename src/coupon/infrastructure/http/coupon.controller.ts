import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import {
  CouponResponseDto,
  UserCouponResponseDto,
  ClaimCouponDto,
} from "./dto/coupon.dto";
import { ApiResponseDto } from "@/common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "@/common/decorators/current-user.decorator";
import { CouponApplicationService } from "@/coupon/application/services/coupon.service";
import { CouponExceptionFilter } from "./filters/coupon-exception.filter";
import { v4 as uuidv4 } from "uuid";

@ApiTags("쿠폰")
@Controller("coupons")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(CouponExceptionFilter)
export class CouponController {
  constructor(private readonly couponService: CouponApplicationService) {}

  @Get()
  @ApiOperation({ summary: "전체 쿠폰 목록" })
  @ApiResponse({
    status: 200,
    description: "쿠폰 목록 조회 성공",
    type: [CouponResponseDto],
  })
  async getAllCoupons(): Promise<ApiResponseDto<CouponResponseDto[]>> {
    const result = await this.couponService.getAllCoupons();
    return ApiResponseDto.success(
      result.map(CouponResponseDto.fromEntity),
      "쿠폰 목록을 조회했습니다"
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
    return ApiResponseDto.success(
      CouponResponseDto.fromEntity(result),
      "쿠폰 정보를 조회했습니다"
    );
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
    const idempotencyKey = claimDto.idempotencyKey || uuidv4();
    const result = await this.couponService.issueUserCoupon({
      couponId,
      userId: user.id,
      couponCode: claimDto.couponCode,
      idempotencyKey,
    });
    return ApiResponseDto.success(
      UserCouponResponseDto.fromEntity(result),
      "쿠폰이 성공적으로 발급되었습니다"
    );
  }
}
