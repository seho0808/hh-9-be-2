import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import { GetProductByIdUseCase } from "../tier-1-in-domain/get-product-by-id.use-case";
import { ProductNotFoundError } from "@/product/application/product.application.exceptions";
import { CacheService } from "@/common/infrastructure/cache/cache.service";
import {
  CACHE_KEYS,
  CACHE_TTL,
} from "@/common/infrastructure/cache/cache-keys.constants";

@Injectable()
export class GetProductByIdWithCacheUseCase {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly cacheService: CacheService
  ) {}

  async execute(productId: string): Promise<Product> {
    const cacheKey = CACHE_KEYS.PRODUCT_DETAILS(productId);
    const cachedProduct = await this.cacheService.get<{
      id: string;
      name: string;
      description: string;
      price: number;
      isActive: boolean;
      totalStock: number;
      reservedStock: number;
      createdAt: string;
      updatedAt: string;
    }>(cacheKey);

    if (cachedProduct)
      return new Product({
        ...cachedProduct,
        createdAt: new Date(cachedProduct.createdAt),
        updatedAt: new Date(cachedProduct.updatedAt),
      });

    const product = await this.getProductByIdUseCase.execute(productId);

    const productCacheData = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      isActive: product.isActive,
      totalStock: product.totalStock,
      reservedStock: product.reservedStock,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    await this.cacheService.set(
      cacheKey,
      productCacheData,
      CACHE_TTL.PRODUCT_DETAILS
    );
    return product;
  }
}
