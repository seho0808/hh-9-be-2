import { GetPopularProductsUseCase } from "@/order/application/use-cases/tier-1-in-domain/get-popular-products.use-case";
import { PopularProductResult } from "@/order/domain/interfaces/order-item.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { Injectable } from "@nestjs/common";
import { GetProductsByIdsUseCase } from "../tier-1-in-domain/get-products-by-ids.use-case";

export interface PopularProductsWithDetailCommand {
  limit?: number;
}

// TODO: 비행기라서 이거 interface로 어떻게 배열 처리하는지를 모르겠음 - 내려서 수정a
export type PopularProductsWithDetailResult = {
  product: Product;
  statistics: PopularProductResult;
}[];

// TODO: unit testing - .spec 구현
@Injectable()
export class GetPopularProductsWithDetailUseCase {
  constructor(
    private readonly getPopularProductsUseCase: GetPopularProductsUseCase,
    private readonly getProductsByIdsUseCase: GetProductsByIdsUseCase
  ) {}

  async execute(
    command: PopularProductsWithDetailCommand
  ): Promise<PopularProductsWithDetailResult> {
    const { limit } = command;
    const popularProductsStats = await this.getPopularProductsUseCase.execute({
      limit,
    });

    if (popularProductsStats.length === 0) {
      return [];
    }

    const productIds = popularProductsStats.map((stat) => stat.productId);
    const products = await this.getProductsByIdsUseCase.execute(productIds);

    const productMap = new Map<string, Product>();
    products.forEach((product) => {
      productMap.set(product.id, product);
    });

    return popularProductsStats
      .map((stat) => {
        const product = productMap.get(stat.productId);
        return product ? { product, statistics: stat } : null;
      })
      .filter(
        (
          item
        ): item is { product: Product; statistics: PopularProductResult } =>
          item !== null
      );
  }
}
