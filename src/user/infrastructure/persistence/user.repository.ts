import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "@/user/domain/entities/user.entity";
import { UserTypeOrmEntity } from "./orm/user.typeorm.entity";

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserTypeOrmEntity)
    private readonly userRepository: Repository<UserTypeOrmEntity>
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.userRepository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.userRepository.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const entity = this.fromDomain(user);
    const savedEntity = await this.userRepository.save(entity);
    return this.toDomain(savedEntity);
  }

  async exists(email: string): Promise<boolean> {
    const count = await this.userRepository.count({ where: { email } });
    return count > 0;
  }

  private toDomain(entity: UserTypeOrmEntity): User {
    return new User({
      id: entity.id,
      email: entity.email,
      password: entity.password,
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private fromDomain(user: User): UserTypeOrmEntity {
    const entity = new UserTypeOrmEntity();
    entity.id = user.id;
    entity.email = user.email;
    entity.password = user.password;
    entity.name = user.name;
    entity.createdAt = user.createdAt;
    entity.updatedAt = user.updatedAt;
    return entity;
  }
}
