import {
  IsOptional,
  IsInt,
  IsString,
  IsBoolean,
  Min,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Product } from "@/product/domain/entities/product.entity";

export class GetAllProductsInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class GetAllProductsOutputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Product)
  products: Product[];

  @IsInt()
  total: number;

  @IsInt()
  page: number;

  @IsInt()
  limit: number;

  @IsInt()
  totalPages: number;

  constructor(partial: Partial<GetAllProductsOutputDto>) {
    Object.assign(this, partial);
  }
}
