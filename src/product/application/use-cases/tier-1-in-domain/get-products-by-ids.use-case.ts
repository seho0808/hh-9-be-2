import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { Transactional } from "typeorm-transactional";

@Injectable()
export class GetProductsByIdsUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface
  ) {}

  @Transactional()
  async execute(productIds: string[]): Promise<Product[]> {
    const products = await this.productRepository.findByIds(productIds);
    return products;
  }
}
