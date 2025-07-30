import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductNotFoundError } from "@/product/domain/exceptions/product.exceptions";
import { Transactional } from "typeorm-transactional";

@Injectable()
export class GetProductByIdUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface
  ) {}

  @Transactional()
  async execute(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    return product;
  }
}
