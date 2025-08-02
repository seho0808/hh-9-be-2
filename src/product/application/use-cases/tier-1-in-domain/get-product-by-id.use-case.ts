import { Injectable } from "@nestjs/common";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { ProductNotFoundError } from "@/product/domain/exceptions/product.exceptions";
import { Transactional } from "typeorm-transactional";

@Injectable()
export class GetProductByIdUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  @Transactional()
  async execute(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    return product;
  }
}
