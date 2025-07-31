import { Injectable } from "@nestjs/common";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { Transactional } from "typeorm-transactional";

export interface GetProductsPriceCommand {
  productIds: string[];
}

export interface GetProductsPriceResult {
  productPriceInfo: { productId: string; unitPrice: number }[];
}

@Injectable()
export class GetProductsPriceUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

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
