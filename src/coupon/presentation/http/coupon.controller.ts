import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseFilters,
  Headers,
  InternalServerErrorException,
  Res,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiAcceptedResponse,
} from "@nestjs/swagger";
import {
  CouponResponseDto,
  UserCouponResponseDto,
  ClaimCouponDto,
  IssueCouponReservationDto,
  IssueCouponReservationResponseDto,
} from "./dto/coupon.dto";
import { ApiResponseDto } from "@/common/presentation/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "@/common/decorators/current-user.decorator";
import { CouponExceptionFilter } from "./filters/coupon-exception.filter";
import { v4 as uuidv4 } from "uuid";
import { GetAllCouponsUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/get-all-coupons.use-case";
import { IssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon.use-case";
import { IssueUserCouponWithSpinLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-spin-lock.use-case";
import { IssueUserCouponWithPubSubLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-pubsub-lock.use-case";
import { IssueUserCouponWithQueueLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-queue-lock.use-case";
import { IssueUserCouponWithFencingLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-fencing-lock.use-case";
import { IssueUserCouponWithRedlockSpinLockUseCase } from "@/coupon/application/use-cases/tier-2/issue-user-coupon-with-redlock-spin-lock.use-case";
import { IssueUserCouponWithRedisUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/issue-user-coupon-with-redis.use-case";
import { GetCouponByIdUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/get-coupon-by-id.use-case";
import { ReserveIssueUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/reserve-issue-user-coupon.use-case";
import { CouponReservation } from "@/coupon/domain/entities/coupon-reservation.entity";
import { GetCouponReservationStatusUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/get-coupon-reservation-status.use-case";

@ApiTags("쿠폰")
@Controller("coupons")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(CouponExceptionFilter)
export class CouponController {
  constructor(
    private readonly getAllCouponsUseCase: GetAllCouponsUseCase,
    private readonly getCouponByIdUseCase: GetCouponByIdUseCase,
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase,
    private readonly issueUserCouponWithRedisUseCase: IssueUserCouponWithRedisUseCase,
    private readonly issueUserCouponWithSpinLockUseCase: IssueUserCouponWithSpinLockUseCase,
    private readonly issueUserCouponWithPubSubLockUseCase: IssueUserCouponWithPubSubLockUseCase,
    private readonly issueUserCouponWithQueueLockUseCase: IssueUserCouponWithQueueLockUseCase,
    private readonly issueUserCouponWithFencingLockUseCase: IssueUserCouponWithFencingLockUseCase,
    private readonly issueUserCouponWithRedlockSpinLockUseCase: IssueUserCouponWithRedlockSpinLockUseCase,
    private readonly reserveIssueUserCouponUseCase: ReserveIssueUserCouponUseCase,
    private readonly getCouponReservationStatusUseCase: GetCouponReservationStatusUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: "전체 쿠폰 목록" })
  @ApiResponse({
    status: 200,
    description: "쿠폰 목록 조회 성공",
    type: [CouponResponseDto],
  })
  async getAllCoupons(): Promise<ApiResponseDto<CouponResponseDto[]>> {
    const result = await this.getAllCouponsUseCase.execute();
    return ApiResponseDto.success(
      result.coupons.map(CouponResponseDto.fromEntity),
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
    const result = await this.getCouponByIdUseCase.execute({ couponId });
    return ApiResponseDto.success(
      CouponResponseDto.fromEntity(result.coupon),
      "쿠폰 정보를 조회했습니다"
    );
  }

  @Post(":couponId/claims")
  @ApiOperation({
    summary: "쿠폰 발급 요청",
    description:
      "X-Lock-Strategy 헤더로 락 전략을 선택할 수 있습니다. 기본값은 'database'입니다. 'spinlock'을 사용하면 스핀락(반복 시도)을 사용합니다.",
  })
  @ApiParam({
    name: "couponId",
    description: "쿠폰 ID",
    example: "coupon-1",
  })
  @ApiHeader({
    name: "X-Lock-Strategy",
    description:
      "락 전략 선택 (database: DB락, spinlock: 스핀락, pubsub: PubSub락, queue: 큐락, fencing: 펜싱락, redlock: Redlock)",
    required: false,
    enum: [
      "database",
      "redis",
      "spinlock",
      "pubsub",
      "queue",
      "fencing",
      "redlock",
    ],
    example: "database",
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
    @Body() claimDto: ClaimCouponDto,
    @Headers("x-lock-strategy") lockStrategy?: string
  ): Promise<ApiResponseDto<UserCouponResponseDto>> {
    const idempotencyKey = claimDto.idempotencyKey || uuidv4();
    const selectedStrategy = lockStrategy?.toLowerCase() || "database";

    const command = {
      couponId,
      userId: user.id,
      couponCode: claimDto.couponCode,
      idempotencyKey,
    };

    let result;
    switch (selectedStrategy) {
      case "redis":
        result = await this.issueUserCouponWithRedisUseCase.execute(command);
        break;
      case "spinlock":
        result = await this.issueUserCouponWithSpinLockUseCase.execute(command);
        break;
      case "pubsub":
        result =
          await this.issueUserCouponWithPubSubLockUseCase.execute(command);
        break;
      case "queue":
        result =
          await this.issueUserCouponWithQueueLockUseCase.execute(command);
        break;
      case "fencing":
        result =
          await this.issueUserCouponWithFencingLockUseCase.execute(command);
        break;
      case "redlock":
        result =
          await this.issueUserCouponWithRedlockSpinLockUseCase.execute(command);
        break;
      default:
        result = await this.issueUserCouponUseCase.execute(command);
        break;
    }

    return ApiResponseDto.success(
      UserCouponResponseDto.fromEntity(result.userCoupon),
      "쿠폰이 성공적으로 발급되었습니다"
    );
  }

  @Post(":couponId/claims/reservations")
  @ApiOperation({ summary: "쿠폰 발급 예약" })
  @ApiParam({
    name: "couponId",
    description: "쿠폰 ID",
    example: "coupon-1",
  })
  @ApiAcceptedResponse({
    description: "쿠폰 발급 예약 성공",
    type: IssueCouponReservationResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: "쿠폰 발급 예약 실패",
  })
  @HttpCode(202)
  async reserveIssueCoupon(
    @CurrentUser() user: CurrentUserData,
    @Param("couponId") couponId: string,
    @Body() reserveDto: IssueCouponReservationDto
  ): Promise<ApiResponseDto<IssueCouponReservationResponseDto>> {
    let couponReservation: CouponReservation;

    try {
      couponReservation = await this.reserveIssueUserCouponUseCase.execute({
        couponId,
        userId: user.id,
        couponCode: reserveDto.couponCode,
        idempotencyKey: reserveDto.idempotencyKey,
      });
    } catch (error) {
      throw new InternalServerErrorException("쿠폰 발급 예약 실패");
    }

    return ApiResponseDto.success(
      IssueCouponReservationResponseDto.fromEntity(couponReservation),
      "쿠폰 발급 예약 성공"
    );
  }

  @Get(":couponId/claims/reservations/:reservationId")
  @ApiOperation({ summary: "쿠폰 발급 예약 상태 조회" })
  @ApiParam({
    name: "reservationId",
    description: "쿠폰 발급 예약 ID",
    example: "reservation-123",
  })
  @ApiResponse({
    status: 200,
    description: "쿠폰 발급 예약 상태 조회 성공",
    type: IssueCouponReservationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "쿠폰 발급 예약 상태를 찾을 수 없음",
  })
  async couponReservationStatus(
    @Param("reservationId") reservationId: string
  ): Promise<ApiResponseDto<IssueCouponReservationResponseDto>> {
    const result = await this.getCouponReservationStatusUseCase.execute({
      reservationId,
    });
    return ApiResponseDto.success(
      IssueCouponReservationResponseDto.fromEntity(result.couponReservation),
      "쿠폰 발급 예약 상태를 조회했습니다"
    );
  }
}
