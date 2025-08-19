export interface PopularProductResult {
  productId: string;
  totalQuantity: number;
}

export interface PopularProductsQueryPort {
  findPopularProducts(limit: number): Promise<PopularProductResult[]>;
}
