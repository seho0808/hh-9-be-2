import { Injectable, Inject } from "@nestjs/common";
import { GetProductsByIdsUseCase } from "../tier-1-in-domain/get-products-by-ids.use-case";
import { Product } from "@/product/domain/entities/product.entity";
import {
  PopularProductResult,
  PopularProductsQueryPort,
} from "@/order/application/ports/popular-products.port";

export interface GetPopularProductsRealtimeCommand {
  limit?: number;
}

export interface GetPopularProductsRealtimeResult {
  popularProductsStats: {
    product: Product;
    statistics: PopularProductResult;
  }[];
}

@Injectable()
export class GetPopularProductsRealtimeUseCase {
  constructor(
    @Inject("REALTIME_POPULAR_PRODUCTS_QUERY_PORT")
    private readonly popularProductsPort: PopularProductsQueryPort,
    private readonly getProductsByIdsUseCase: GetProductsByIdsUseCase
  ) {}

  async execute(
    command: GetPopularProductsRealtimeCommand
  ): Promise<GetPopularProductsRealtimeResult> {
    const { limit } = command;

    const popularProductsStats =
      await this.popularProductsPort.findPopularProducts(limit || 10);

    const productIds = popularProductsStats.map((stat) => stat.productId);
    const products = await this.getProductsByIdsUseCase.execute(productIds);

    const productMap = new Map<string, Product>();
    products.forEach((product) => {
      productMap.set(product.id, product);
    });

    const popularProductsStatsWithDetail = popularProductsStats
      .map((stat) => {
        const product = productMap.get(stat.productId);
        return product
          ? {
              product,
              statistics: stat,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return { popularProductsStats: popularProductsStatsWithDetail };
  }
}
