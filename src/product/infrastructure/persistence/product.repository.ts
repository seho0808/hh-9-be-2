import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository, EntityManager } from "typeorm";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductTypeOrmEntity } from "./orm/product.typeorm.entity";
import { TransactionContext } from "@/common/services/transaction.service";

@Injectable()
export class ProductRepository implements ProductRepositoryInterface {
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(ProductTypeOrmEntity)
    private readonly productRepository: Repository<ProductTypeOrmEntity>
  ) {
    TransactionContext.registerRepository(this);
  }

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<ProductTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(ProductTypeOrmEntity)
      : this.productRepository;
  }

  async findById(id: string): Promise<Product | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const repository = this.getRepository();
    const entities = await repository.find({
      where: { id: In(ids) },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByName(name: string): Promise<Product | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({ where: { name } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(product: Product): Promise<Product> {
    const repository = this.getRepository();
    const entity = this.fromDomain(product);
    const savedEntity = await repository.save(entity);
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
    const repository = this.getRepository();
    const queryBuilder = repository.createQueryBuilder("product");

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
