import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { UserRepositoryInterface } from "@/user/domain/interfaces/user.repository.interface";
import { User } from "@/user/domain/entities/user.entity";
import { UserTypeOrmEntity } from "./orm/user.typeorm.entity";

@Injectable()
export class UserRepository implements UserRepositoryInterface {
  private entityManager?: EntityManager;

  constructor(
    @InjectRepository(UserTypeOrmEntity)
    private readonly userRepository: Repository<UserTypeOrmEntity>
  ) {}

  setEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  clearEntityManager(): void {
    this.entityManager = undefined;
  }

  private getRepository(): Repository<UserTypeOrmEntity> {
    return this.entityManager
      ? this.entityManager.getRepository(UserTypeOrmEntity)
      : this.userRepository;
  }

  async findById(id: string): Promise<User | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const repository = this.getRepository();
    const entity = await repository.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const repository = this.getRepository();
    const entity = this.fromDomain(user);
    const savedEntity = await repository.save(entity);
    return this.toDomain(savedEntity);
  }

  async exists(email: string): Promise<boolean> {
    const repository = this.getRepository();
    const count = await repository.count({ where: { email } });
    return count > 0;
  }

  private toDomain(entity: UserTypeOrmEntity): User {
    return User.fromPersistence({
      id: entity.id,
      email: entity.email,
      password: entity.password,
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private fromDomain(user: User): UserTypeOrmEntity {
    const props = user.toPersistence();
    const entity = new UserTypeOrmEntity();
    entity.id = props.id;
    entity.email = props.email;
    entity.password = props.password;
    entity.name = props.name;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }
}
