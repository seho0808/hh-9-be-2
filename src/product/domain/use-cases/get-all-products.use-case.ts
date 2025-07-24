import { Injectable, Inject } from "@nestjs/common";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";

export interface GetAllProductsCommand {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface GetAllProductsResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class GetAllProductsUseCase {
  constructor(
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepositoryInterface
  ) {}

  async execute(command: GetAllProductsCommand): Promise<GetAllProductsResult> {
    const page = command.page || 1;
    const limit = command.limit || 10;
    const offset = (page - 1) * limit;

    const filters = {
      isActive: command.isActive,
      search: command.search,
    };

    const { products, total } = await this.productRepository.findPaginated(
      offset,
      limit,
      filters
    );

    const totalPages = Math.ceil(total / limit);

    return {
      products,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
