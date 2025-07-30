import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";

export interface GetProductsPriceCommand {
  productIds: string[];
}

export interface GetProductsPriceResult {
  productPriceInfo: { productId: string; unitPrice: number }[];
}

@Injectable()
export class GetProductsPriceUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface
  ) {}

  @Transactional()
  async execute(
    command: GetProductsPriceCommand
  ): Promise<GetProductsPriceResult> {
    const { productIds } = command;

    const products = await this.productRepository.findByIds(productIds);

    const productsWithPrices = products.map((product) => ({
      productId: product.id,
      unitPrice: product.price,
    }));

    return {
      productPriceInfo: productsWithPrices,
    };
  }
}
