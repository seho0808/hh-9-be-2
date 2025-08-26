import { Injectable, Inject } from "@nestjs/common";
import {
  PopularProductResult,
  PopularProductsQueryPort,
} from "@/order/application/ports/popular-products.port";

export interface GetPopularProductsCommand {
  limit?: number;
}

@Injectable()
export class GetPopularProductsUseCase {
  constructor(
    @Inject("POPULAR_PRODUCTS_QUERY_PORT")
    private readonly popularProductsPort: PopularProductsQueryPort
  ) {}

  async execute(
    command: GetPopularProductsCommand
  ): Promise<PopularProductResult[]> {
    const { limit = 10 } = command;
    return await this.popularProductsPort.findPopularProducts(limit);
  }
}
