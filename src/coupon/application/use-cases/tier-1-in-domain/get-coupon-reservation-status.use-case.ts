import { CouponReservation } from "@/coupon/domain/entities/coupon-reservation.entity";
import { CouponReservationRepository } from "@/coupon/infrastructure/persistence/coupon-reservation.repository";
import { Injectable } from "@nestjs/common";

export interface GetCouponReservationStatusCommand {
  reservationId: string;
}

export interface GetCouponReservationStatusResult {
  couponReservation: CouponReservation;
}

@Injectable()
export class GetCouponReservationStatusUseCase {
  constructor(
    private readonly couponReservationRepository: CouponReservationRepository
  ) {}

  async execute(
    command: GetCouponReservationStatusCommand
  ): Promise<GetCouponReservationStatusResult> {
    const couponReservation = await this.couponReservationRepository.findById(
      command.reservationId
    );
    return { couponReservation };
  }
}
