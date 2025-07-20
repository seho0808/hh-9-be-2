import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  CouponResponseDto,
  UserCouponResponseDto,
  ClaimCouponDto,
  CouponQueryDto,
  DiscountCalculationDto,
  CouponType,
  CouponStatus,
} from "../dto/coupon.dto";
import { PaginatedResponseDto } from "../../common/dto/response.dto";

interface MockCoupon {
  id: string;
  code: string;
  name: string;
  type: CouponType;
  discountValue: number;
  maxDiscount?: number;
  minOrderAmount: number;
  totalQuantity: number;
  usedQuantity: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockUserCoupon {
  id: string;
  userId: string;
  couponId: string;
  status: CouponStatus;
  issuedAt: Date;
  usedAt?: Date;
}

@Injectable()
export class CouponMockService {
  // Mock 쿠폰 데이터베이스
  private mockCoupons: MockCoupon[] = [
    {
      id: "coupon-1",
      code: "WELCOME2024",
      name: "신규 회원 환영 쿠폰",
      type: CouponType.PERCENTAGE,
      discountValue: 10,
      maxDiscount: 5000,
      minOrderAmount: 50000,
      totalQuantity: 1000,
      usedQuantity: 145,
      validFrom: new Date("2024-01-01"),
      validTo: new Date("2024-12-31"),
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    {
      id: "coupon-2",
      code: "SPRING5000",
      name: "봄맞이 5천원 할인",
      type: CouponType.FIXED_AMOUNT,
      discountValue: 5000,
      minOrderAmount: 30000,
      totalQuantity: 500,
      usedQuantity: 278,
      validFrom: new Date("2024-03-01"),
      validTo: new Date("2024-05-31"),
      isActive: true,
      createdAt: new Date("2024-03-01"),
      updatedAt: new Date("2024-03-01"),
    },
    {
      id: "coupon-3",
      code: "VIP20",
      name: "VIP 고객 20% 할인",
      type: CouponType.PERCENTAGE,
      discountValue: 20,
      maxDiscount: 10000,
      minOrderAmount: 100000,
      totalQuantity: 100,
      usedQuantity: 89,
      validFrom: new Date("2024-01-01"),
      validTo: new Date("2024-12-31"),
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    {
      id: "coupon-4",
      code: "SOLDOUT2024",
      name: "완전 소진된 쿠폰",
      type: CouponType.FIXED_AMOUNT,
      discountValue: 10000,
      minOrderAmount: 50000,
      totalQuantity: 50,
      usedQuantity: 50,
      validFrom: new Date("2024-01-01"),
      validTo: new Date("2024-12-31"),
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  ];

  // Mock 사용자 쿠폰 데이터베이스
  private mockUserCoupons: MockUserCoupon[] = [
    {
      id: "user-coupon-1",
      userId: "user-123",
      couponId: "coupon-1",
      status: CouponStatus.ACTIVE,
      issuedAt: new Date("2024-01-05"),
    },
    {
      id: "user-coupon-2",
      userId: "user-123",
      couponId: "coupon-2",
      status: CouponStatus.USED,
      issuedAt: new Date("2024-03-10"),
      usedAt: new Date("2024-03-15"),
    },
  ];

  private userCouponIdCounter = 3;

  async getAvailableCoupons(
    query: CouponQueryDto
  ): Promise<PaginatedResponseDto<CouponResponseDto>> {
    let filteredCoupons = this.mockCoupons.filter((c) => {
      const now = new Date();
      return c.isActive && c.validFrom <= now && c.validTo >= now;
    });

    // 쿠폰 타입 필터
    if (query.type) {
      filteredCoupons = filteredCoupons.filter((c) => c.type === query.type);
    }

    // 페이지네이션
    const page = query.page || 1;
    const limit = query.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedCoupons = filteredCoupons.slice(startIndex, endIndex);

    const responseCoupons: CouponResponseDto[] = paginatedCoupons.map((c) =>
      this.toCouponResponseDto(c)
    );

    return new PaginatedResponseDto(
      responseCoupons,
      filteredCoupons.length,
      page,
      limit
    );
  }

  async getCouponById(couponId: string): Promise<CouponResponseDto> {
    const coupon = this.mockCoupons.find((c) => c.id === couponId);
    if (!coupon) {
      throw new NotFoundException("쿠폰을 찾을 수 없습니다");
    }

    return this.toCouponResponseDto(coupon);
  }

  async claimCoupon(
    userId: string,
    couponId: string,
    claimDto: ClaimCouponDto
  ): Promise<UserCouponResponseDto> {
    const coupon = this.mockCoupons.find((c) => c.id === couponId);
    if (!coupon) {
      throw new NotFoundException("쿠폰을 찾을 수 없습니다");
    }

    // 쿠폰 코드 확인
    if (coupon.code !== claimDto.couponCode) {
      throw new BadRequestException("쿠폰 코드가 일치하지 않습니다");
    }

    // 쿠폰 유효성 검사
    const now = new Date();
    if (!coupon.isActive || coupon.validFrom > now || coupon.validTo < now) {
      throw new BadRequestException("유효하지 않은 쿠폰입니다");
    }

    // 이미 발급받은 쿠폰인지 확인
    const existingUserCoupon = this.mockUserCoupons.find(
      (uc) => uc.userId === userId && uc.couponId === couponId
    );
    if (existingUserCoupon) {
      throw new ConflictException("이미 발급받은 쿠폰입니다");
    }

    // 수량 확인
    if (coupon.usedQuantity >= coupon.totalQuantity) {
      throw new BadRequestException("쿠폰이 모두 소진되었습니다");
    }

    // 쿠폰 발급
    coupon.usedQuantity++;
    coupon.updatedAt = new Date();

    const newUserCoupon: MockUserCoupon = {
      id: `user-coupon-${this.userCouponIdCounter++}`,
      userId,
      couponId,
      status: CouponStatus.ACTIVE,
      issuedAt: new Date(),
    };
    this.mockUserCoupons.push(newUserCoupon);

    return this.toUserCouponResponseDto(newUserCoupon, coupon);
  }

  async getUserCoupons(userId: string): Promise<UserCouponResponseDto[]> {
    const userCoupons = this.mockUserCoupons.filter(
      (uc) => uc.userId === userId
    );

    const result: UserCouponResponseDto[] = [];
    for (const userCoupon of userCoupons) {
      const coupon = this.mockCoupons.find((c) => c.id === userCoupon.couponId);
      if (coupon) {
        result.push(this.toUserCouponResponseDto(userCoupon, coupon));
      }
    }

    // 발급일 기준 최신순 정렬
    return result.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  }

  async calculateDiscount(
    couponId: string,
    orderAmount: number
  ): Promise<DiscountCalculationDto> {
    const coupon = this.mockCoupons.find((c) => c.id === couponId);
    if (!coupon) {
      throw new NotFoundException("쿠폰을 찾을 수 없습니다");
    }

    // 최소 주문 금액 확인
    if (orderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(
        `최소 주문 금액 ${coupon.minOrderAmount.toLocaleString()}원 이상이어야 합니다`
      );
    }

    let discountAmount = 0;

    if (coupon.type === CouponType.PERCENTAGE) {
      // 퍼센트 할인
      discountAmount = Math.floor((orderAmount * coupon.discountValue) / 100);

      // 최대 할인 금액 제한
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      // 고정 금액 할인
      discountAmount = coupon.discountValue;
    }

    // 할인 금액이 주문 금액을 초과하지 않도록
    if (discountAmount > orderAmount) {
      discountAmount = orderAmount;
    }

    return {
      originalAmount: orderAmount,
      discountAmount,
      finalAmount: orderAmount - discountAmount,
      appliedCoupon: this.toCouponResponseDto(coupon),
    };
  }

  // 주문 시스템에서 사용할 내부 메서드들
  async validateAndUseCoupon(
    userId: string,
    couponId: string,
    orderAmount: number
  ): Promise<DiscountCalculationDto> {
    const userCoupon = this.mockUserCoupons.find(
      (uc) =>
        uc.userId === userId &&
        uc.couponId === couponId &&
        uc.status === CouponStatus.ACTIVE
    );

    if (!userCoupon) {
      throw new NotFoundException("사용 가능한 쿠폰을 찾을 수 없습니다");
    }

    const discountCalculation = await this.calculateDiscount(
      couponId,
      orderAmount
    );

    // 쿠폰 사용 처리
    userCoupon.status = CouponStatus.USED;
    userCoupon.usedAt = new Date();

    return discountCalculation;
  }

  async restoreCoupon(userId: string, couponId: string): Promise<boolean> {
    const userCoupon = this.mockUserCoupons.find(
      (uc) =>
        uc.userId === userId &&
        uc.couponId === couponId &&
        uc.status === CouponStatus.USED
    );

    if (userCoupon) {
      userCoupon.status = CouponStatus.ACTIVE;
      userCoupon.usedAt = undefined;
      return true;
    }

    return false;
  }

  private toCouponResponseDto(coupon: MockCoupon): CouponResponseDto {
    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      minOrderAmount: coupon.minOrderAmount,
      totalQuantity: coupon.totalQuantity,
      usedQuantity: coupon.usedQuantity,
      remainingQuantity: coupon.totalQuantity - coupon.usedQuantity,
      validFrom: coupon.validFrom,
      validTo: coupon.validTo,
      isActive: coupon.isActive,
      canIssue: coupon.isActive && coupon.usedQuantity < coupon.totalQuantity,
    };
  }

  private toUserCouponResponseDto(
    userCoupon: MockUserCoupon,
    coupon: MockCoupon
  ): UserCouponResponseDto {
    const now = new Date();
    const canUse =
      userCoupon.status === CouponStatus.ACTIVE &&
      coupon.isActive &&
      coupon.validFrom <= now &&
      coupon.validTo >= now;

    return {
      id: userCoupon.id,
      userId: userCoupon.userId,
      coupon: this.toCouponResponseDto(coupon),
      status: userCoupon.status,
      issuedAt: userCoupon.issuedAt,
      usedAt: userCoupon.usedAt,
      canUse,
    };
  }
}
