import { Injectable } from "@nestjs/common";
import { CacheService } from "@/common/infrastructure/cache/cache.service";
import {
  CACHE_KEYS,
  CACHE_TTL,
} from "@/common/infrastructure/cache/cache-keys.constants";
import {
  GetPopularProductsWithDetailUseCase,
  GetPopularProductsWithDetailCommand,
  GetPopularProductsWithDetailResult,
} from "../tier-2/get-popular-products-with-detail.use-case";
import { Product } from "@/product/domain/entities/product.entity";

@Injectable()
export class GetPopularProductsWithDetailWithCacheUseCase {
  constructor(
    private readonly getPopularProductsWithDetailUseCase: GetPopularProductsWithDetailUseCase,
    private readonly cacheService: CacheService
  ) {}

  async execute(
    command: GetPopularProductsWithDetailCommand
  ): Promise<GetPopularProductsWithDetailResult> {
    const cachedData = await this.cacheService.get<any>(
      CACHE_KEYS.POPULAR_PRODUCTS
    );
    if (cachedData) {
      const restoredData: GetPopularProductsWithDetailResult = {
        popularProductsStats: cachedData.popularProductsStats.map(
          (item: any) => ({
            product: new Product({
              ...item.product.props,
              createdAt: new Date(item.product.props.createdAt),
              updatedAt: new Date(item.product.props.updatedAt),
            }),
            statistics: item.statistics,
          })
        ),
      };
      return restoredData;
    }

    const result =
      await this.getPopularProductsWithDetailUseCase.execute(command);

    await this.cacheService.setMultiple([
      {
        key: CACHE_KEYS.POPULAR_PRODUCTS,
        value: result,
        ttl: CACHE_TTL.POPULAR_PRODUCTS,
      },
      {
        key: CACHE_KEYS.POPULAR_PRODUCTS_LAST_UPDATED,
        value: new Date().toISOString(),
        ttl: CACHE_TTL.POPULAR_PRODUCTS,
      },
    ]);

    return result;
  }
}
