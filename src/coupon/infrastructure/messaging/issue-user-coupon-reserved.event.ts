export interface IssueUserCouponReservedEvent {
  eventId: string;
  eventType: "issue.usercoupon.reserved";
  timestamp: string;
  data: {
    couponId: string;
    userId: string;
    couponCode: string;
    idempotencyKey: string;
  };
}
