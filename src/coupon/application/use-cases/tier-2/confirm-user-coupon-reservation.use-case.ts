import { CouponReservationRepository } from "@/coupon/infrastructure/persistence/coupon-reservation.repository";
import { Transactional } from "typeorm-transactional";
import { CouponReservationNotFoundError } from "../../coupon.application.exceptions";
import { IssueUserCouponUseCase } from "../tier-1-in-domain/issue-user-coupon.use-case";
import { CouponReservation } from "@/coupon/domain/entities/coupon-reservation.entity";

export interface ConfirmUserCouponReservationCommand {
  reservationId: string;
  idempotencyKey: string;
}

export interface ConfirmUserCouponReservationResult {
  couponReservation: CouponReservation;
}

export class ConfirmUserCouponReservationUseCase {
  constructor(
    private readonly issueUserCouponUseCase: IssueUserCouponUseCase,
    private readonly couponReservationRepository: CouponReservationRepository
  ) {}

  // TODO: 낙관적 락 처리
  @Transactional()
  async execute(
    command: ConfirmUserCouponReservationCommand
  ): Promise<ConfirmUserCouponReservationResult> {
    const { reservationId, idempotencyKey } = command;

    const couponReservation =
      await this.couponReservationRepository.findById(reservationId);

    if (!couponReservation) {
      throw new CouponReservationNotFoundError(reservationId);
    }
    couponReservation.confirm();
    await this.couponReservationRepository.save(couponReservation);
    await this.issueUserCouponUseCase.execute({
      couponId: couponReservation.couponId,
      userId: couponReservation.userId,
      couponCode: couponReservation.couponCode,
      idempotencyKey,
    });

    return {
      couponReservation,
    };
  }
}
