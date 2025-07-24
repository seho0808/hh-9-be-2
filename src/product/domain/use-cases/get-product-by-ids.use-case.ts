import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";

@Injectable()
export class GetProductByIdsUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface
  ) {}

  async execute(productIds: string[]): Promise<Product[]> {
    const products = await this.productRepository.findByIds(productIds);
    return products;
  }
}
