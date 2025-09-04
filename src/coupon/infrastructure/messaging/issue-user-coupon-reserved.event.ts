export interface IssueUserCouponReservedEvent {
  eventId: string;
  eventType: "issue.usercoupon.reserved";
  timestamp: string;
  idempotencyKey: string;
  data: {
    reservationId: string;
    couponId: string;
  };
}
