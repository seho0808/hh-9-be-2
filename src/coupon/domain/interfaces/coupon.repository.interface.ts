import { Coupon } from "../entities/coupon.entity";

export interface CouponRepositoryInterface {
  save(coupon: Coupon): Promise<Coupon>;
  findById(id: string): Promise<Coupon | null>;
  findAll(): Promise<Coupon[]>;
}
