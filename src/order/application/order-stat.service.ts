import { Injectable } from "@nestjs/common";
import { GetPopularProductsUseCase } from "@/order/application/use-cases/get-popular-products.use-case";
import { PopularProductResult } from "@/order/domain/interfaces/order-item.repository.interface";

@Injectable()
export class OrderStatApplicationService {
  constructor(
    private readonly getPopularProductsUseCase: GetPopularProductsUseCase
  ) {}

  async getPopularProducts(limit: number): Promise<PopularProductResult[]> {
    return await this.getPopularProductsUseCase.execute({ limit });
  }
}
