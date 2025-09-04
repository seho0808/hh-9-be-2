import { Injectable, OnModuleInit } from "@nestjs/common";
import { KafkaManager } from "@/common/infrastructure/config/kafka.config";
import { IssueUserCouponReservedEvent } from "@/coupon/infrastructure/messaging/issue-user-coupon-reserved.event";
import { ConfirmUserCouponReservationUseCase } from "@/coupon/application/use-cases/tier-2/confirm-user-coupon-reservation.use-case";

@Injectable()
export class IssueUserCouponReservedConsumer implements OnModuleInit {
  private readonly topic = "issue.usercoupon.reserved";

  constructor(
    private readonly kafkaManager: KafkaManager,
    private readonly confirmUserCouponReservationUseCase: ConfirmUserCouponReservationUseCase
  ) {}

  async onModuleInit(): Promise<void> {
    const consumer = this.kafkaManager.getConsumer();
    await consumer.subscribe({ topic: this.topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const event: IssueUserCouponReservedEvent = JSON.parse(
          message.value.toString()
        );

        const { reservationId } = event.data;
        const { idempotencyKey } = event;

        await this.confirmUserCouponReservationUseCase.execute({
          reservationId,
          idempotencyKey,
        });
      },
    });
  }
}
