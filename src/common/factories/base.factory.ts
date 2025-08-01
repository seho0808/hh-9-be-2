import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export interface BaseEntityProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EntityFactory<T extends BaseEntityProps> = {
  create(options?: Partial<T>): T;
  createAndSave(repository: Repository<T>, options?: Partial<T>): Promise<T>;
  createMany(count: number, baseOptions?: Partial<T>): T[];
  createManyAndSave(
    repository: Repository<T>,
    count: number,
    baseOptions?: Partial<T>
  ): Promise<T[]>;
  createManyWithOptions(optionsArray: Partial<T>[]): T[];
  createManyWithOptionsAndSave(
    repository: Repository<T>,
    optionsArray: Partial<T>[]
  ): Promise<T[]>;
  resetCounter(): void;
};

export function createEntityFactory<T extends BaseEntityProps>(
  entityCreator: (options: Partial<T>, counter: number) => T
): EntityFactory<T> {
  let counter = 1;

  const factory = {
    create(options: Partial<T> = {}) {
      const entity = entityCreator(options, counter++);
      return entity;
    },

    async createAndSave(repository: Repository<T>, options: Partial<T> = {}) {
      const entity = factory.create(options);
      return await repository.save(entity);
    },

    createMany(count: number, baseOptions: Partial<T> = {}) {
      return Array.from({ length: count }, () =>
        factory.create({
          ...baseOptions,
          id: baseOptions.id || uuidv4(),
        })
      );
    },

    async createManyAndSave(
      repository: Repository<T>,
      count: number,
      baseOptions: Partial<T> = {}
    ) {
      const entities = factory.createMany(count, baseOptions);
      return await repository.save(entities);
    },

    createManyWithOptions(optionsArray: Partial<T>[]) {
      return optionsArray.map((options) => factory.create(options));
    },

    async createManyWithOptionsAndSave(
      repository: Repository<T>,
      optionsArray: Partial<T>[]
    ) {
      const entities = factory.createManyWithOptions(optionsArray);
      return await repository.save(entities);
    },

    resetCounter() {
      counter = 1;
    },
  };

  return factory;
}

export function getBaseProps(): BaseEntityProps {
  const now = new Date();
  return {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
}
