import { CouponReservation } from "@/coupon/domain/entities/coupon-reservation.entity";
import { CouponReservationRepository } from "@/coupon/infrastructure/persistence/coupon-reservation.repository";
import { OutboxRepository } from "@/common/infrastructure/persistence/outbox.repository";
import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";

export interface PublishIssueUserCouponEventCommand {
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
}

@Injectable()
export class ReserveIssueUserCouponUseCase {
  constructor(
    private readonly couponReservationRepository: CouponReservationRepository,
    private readonly outboxRepository: OutboxRepository
  ) {}

  @Transactional()
  async execute(
    command: PublishIssueUserCouponEventCommand
  ): Promise<CouponReservation> {
    const { couponId, userId, couponCode, idempotencyKey } = command;

    const couponReservation = CouponReservation.create({
      couponId,
      userId,
      couponCode,
      idempotencyKey,
    });

    await this.couponReservationRepository.save(couponReservation);
    await this.outboxRepository.appendEvent({
      eventType: "issue.usercoupon.reserved",
      payload: couponReservation,
      idempotencyKey,
    });

    return couponReservation;
  }
}
