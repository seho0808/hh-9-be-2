import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";

export interface GetProductsPriceCommand {
  productIds: string[];
}

export interface GetProductsPriceResult {
  productPriceInfo: { productId: string; unitPrice: number }[];
}

export class GetProductsPriceUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

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
