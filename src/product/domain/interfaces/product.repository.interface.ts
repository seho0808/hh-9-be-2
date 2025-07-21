import { Product } from "../entities/product.entity";

export interface ProductRepositoryInterface {
  findById(id: string): Promise<Product | null>;
  findByName(name: string): Promise<Product | null>;
  save(product: Product): Promise<Product>;
  findPaginated(
    offset: number,
    limit: number,
    filters?: {
      isActive?: boolean;
      search?: string;
    }
  ): Promise<{ products: Product[]; total: number }>;
}
