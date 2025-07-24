import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductTypeOrmEntity } from "./orm/product.typeorm.entity";

@Injectable()
export class ProductRepository implements ProductRepositoryInterface {
  constructor(
    @InjectRepository(ProductTypeOrmEntity)
    private readonly productRepository: Repository<ProductTypeOrmEntity>
  ) {}

  async findById(id: string): Promise<Product | null> {
    const entity = await this.productRepository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const entities = await this.productRepository.find({
      where: { id: In(ids) },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByName(name: string): Promise<Product | null> {
    const entity = await this.productRepository.findOne({ where: { name } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(product: Product): Promise<Product> {
    const entity = this.fromDomain(product);
    const savedEntity = await this.productRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findPaginated(
    offset: number,
    limit: number,
    filters?: {
      isActive?: boolean;
      search?: string;
    }
  ): Promise<{ products: Product[]; total: number }> {
    const queryBuilder = this.productRepository.createQueryBuilder("product");

    // 활성화 상태 필터
    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere("product.isActive = :isActive", {
        isActive: filters.isActive,
      });
    }

    // 검색 키워드 필터
    if (filters?.search) {
      queryBuilder.andWhere(
        "(product.name LIKE :search OR product.description LIKE :search)",
        { search: `%${filters.search}%` }
      );
    }

    // 전체 개수 조회
    const total = await queryBuilder.getCount();

    // 페이지네이션 적용
    const entities = await queryBuilder.skip(offset).take(limit).getMany();

    return {
      products: entities.map((entity) => this.toDomain(entity)),
      total,
    };
  }

  private toDomain(entity: ProductTypeOrmEntity): Product {
    return Product.fromPersistence({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      price: entity.price,
      totalStock: entity.totalStock,
      reservedStock: entity.reservedStock,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private fromDomain(product: Product): ProductTypeOrmEntity {
    const props = product.toPersistence();
    const entity = new ProductTypeOrmEntity();
    entity.id = props.id;
    entity.name = props.name;
    entity.description = props.description;
    entity.price = props.price;
    entity.totalStock = props.totalStock;
    entity.reservedStock = props.reservedStock;
    entity.isActive = props.isActive;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }
}
