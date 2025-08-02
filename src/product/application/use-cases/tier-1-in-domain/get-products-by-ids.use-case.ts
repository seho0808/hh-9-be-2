import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { Transactional } from "typeorm-transactional";

@Injectable()
export class GetProductsByIdsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  @Transactional()
  async execute(productIds: string[]): Promise<Product[]> {
    const products = await this.productRepository.findByIds(productIds);
    return products;
  }
}
