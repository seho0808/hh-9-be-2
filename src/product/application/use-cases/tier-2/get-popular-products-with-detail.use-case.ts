import { GetPopularProductsUseCase } from "@/order/application/use-cases/tier-1-in-domain/get-popular-products.use-case";
import { Product } from "@/product/domain/entities/product.entity";
import { Injectable } from "@nestjs/common";
import { GetProductsByIdsUseCase } from "../tier-1-in-domain/get-products-by-ids.use-case";
import { PopularProductResult } from "@/order/application/ports/popular-products.port";

export interface GetPopularProductsWithDetailCommand {
  limit?: number;
}

export interface GetPopularProductsWithDetailResult {
  popularProductsStats: {
    product: Product;
    statistics: PopularProductResult;
  }[];
}

@Injectable()
export class GetPopularProductsWithDetailUseCase {
  constructor(
    private readonly getPopularProductsUseCase: GetPopularProductsUseCase,
    private readonly getProductsByIdsUseCase: GetProductsByIdsUseCase
  ) {}

  async execute(
    command: GetPopularProductsWithDetailCommand
  ): Promise<GetPopularProductsWithDetailResult> {
    const { limit } = command;
    const popularProductsStats = await this.getPopularProductsUseCase.execute({
      limit,
    });
    const productIds = popularProductsStats.map((stat) => stat.productId);
    const products = await this.getProductsByIdsUseCase.execute(productIds);

    const productMap = new Map<string, Product>();
    products.forEach((product) => {
      productMap.set(product.id, product);
    });

    const popularProductsStatsWithDetail = popularProductsStats.map((stat) => ({
      product: productMap.get(stat.productId),
      statistics: stat,
    }));

    return { popularProductsStats: popularProductsStatsWithDetail };
  }
}
