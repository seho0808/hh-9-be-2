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
  PopularProductResult,
} from "../tier-2/get-popular-products-with-detail.use-case";
import { Product } from "@/product/domain/entities/product.entity";

interface PopularProductsWithDetailCacheData {
  popularProductsStats: {
    product: {
      id: string;
      name: string;
      description: string;
      price: number;
      totalStock: number;
      reservedStock: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    statistics: PopularProductResult;
  }[];
  lastUpdated: string;
}

@Injectable()
export class GetPopularProductsWithDetailWithCacheUseCase {
  constructor(
    private readonly getPopularProductsWithDetailUseCase: GetPopularProductsWithDetailUseCase,
    private readonly cacheService: CacheService
  ) {}

  async execute(
    command: GetPopularProductsWithDetailCommand
  ): Promise<GetPopularProductsWithDetailResult> {
    const cachedData =
      await this.cacheService.get<PopularProductsWithDetailCacheData>(
        CACHE_KEYS.POPULAR_PRODUCTS
      );
    if (cachedData) {
      const restoredData: GetPopularProductsWithDetailResult = {
        popularProductsStats: cachedData.popularProductsStats.map((item) => ({
          product: new Product({
            ...item.product,
            createdAt: new Date(item.product.createdAt),
            updatedAt: new Date(item.product.updatedAt),
          }),
          statistics: item.statistics,
        })),
      };
      return restoredData;
    }

    const result =
      await this.getPopularProductsWithDetailUseCase.execute(command);

    const cacheData: PopularProductsWithDetailCacheData = {
      popularProductsStats: result.popularProductsStats.map((item) => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          price: item.product.price,
          totalStock: item.product.totalStock,
          reservedStock: item.product.reservedStock,
          isActive: item.product.isActive,
          createdAt: item.product.createdAt,
          updatedAt: item.product.updatedAt,
        },
        statistics: item.statistics,
      })),
      lastUpdated: new Date().toISOString(),
    };

    await this.cacheService.set(
      CACHE_KEYS.POPULAR_PRODUCTS,
      cacheData,
      CACHE_TTL.POPULAR_PRODUCTS
    );

    return result;
  }
}
