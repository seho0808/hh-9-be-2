import { Injectable } from "@nestjs/common";
import { GetProductByIdUseCase } from "@/product/domain/use-cases/get-product-by-id.use-case";
import { GetAllProductsUseCase } from "@/product/domain/use-cases/get-all-products.use-case";
import {
  GetAllProductsInputDto,
  GetAllProductsOutputDto,
} from "@/product/application/dto/get-all-products";
import {
  ReserveStockUseCase,
  ReserveStockCommand,
} from "@/product/domain/use-cases/reserve-stock.use-case";
import {
  ReleaseStockUseCase,
  ReleaseStockCommand,
} from "@/product/domain/use-cases/release-stock.use-case";
import { Product } from "@/product/domain/entities/product.entity";
import { validateOrReject } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ProductValidationException } from "@/product/application/exceptions/validation.exception";

@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase
  ) {}

  async getProductById(productId: string): Promise<Product> {
    return await this.getProductByIdUseCase.execute(productId);
  }

  async getAllProducts(
    query: GetAllProductsInputDto
  ): Promise<GetAllProductsOutputDto> {
    const dto = plainToInstance(GetAllProductsInputDto, query);
    await validateOrReject(dto).catch((errors) => {
      throw new ProductValidationException(errors);
    });

    return this.getAllProductsUseCase.execute(dto);
  }

  async reserveStock(command: ReserveStockCommand): Promise<Product> {
    const { product } = await this.reserveStockUseCase.execute(command);
    return product;
  }

  async releaseStock(command: ReleaseStockCommand): Promise<Product> {
    const { product } = await this.releaseStockUseCase.execute(command);
    return product;
  }

  async getPopularProducts(limit?: number): Promise<any[]> {
    // TODO: Order 도메인 구현 진행 된 후에 구현 가능함.
    return [];
  }
}
