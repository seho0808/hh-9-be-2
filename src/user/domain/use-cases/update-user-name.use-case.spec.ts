import { Test, TestingModule } from "@nestjs/testing";
import {
  UpdateUserNameUseCase,
  UpdateUserNameCommand,
} from "./update-user-name.use-case";
import { UserRepositoryInterface } from "../../domain/interfaces/user.repository.interface";
import { User } from "../../domain/entities/user.entity";
import {
  UserNotFoundError,
  InvalidUserNameError,
} from "../../domain/exceptions/user.exceptions";

describe("UpdateUserNameUseCase", () => {
  let updateUserNameUseCase: UpdateUserNameUseCase;
  let mockUserRepository: jest.Mocked<UserRepositoryInterface>;

  beforeEach(async () => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserNameUseCase,
        {
          provide: "UserRepositoryInterface",
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    updateUserNameUseCase = module.get<UpdateUserNameUseCase>(
      UpdateUserNameUseCase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    const userId = "test-user-id";
    const newName = "Updated Name";
    const validCommand: UpdateUserNameCommand = {
      userId,
      newName,
    };

    let existingUser: User;

    beforeEach(() => {
      existingUser = User.create({
        email: "test@example.com",
        password: "hashedPassword",
        name: "Original Name",
      });
    });

    it("사용자 이름을 성공적으로 업데이트해야 함", async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);
      const updatedUser = User.fromPersistence({
        ...existingUser.toPersistence(),
        name: newName,
        updatedAt: new Date(),
      });
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await updateUserNameUseCase.execute(validCommand);

      expect(result).toEqual(updatedUser);
      expect(existingUser.name).toBe(newName);
    });

    it.each([
      {
        description:
          "유효하지 않은 사용자 이름에 대해 InvalidUserNameError를 발생시켜야 함",
        command: { userId, newName: "a" },
      },
      {
        description:
          "금지된 사용자 이름에 대해 InvalidUserNameError를 발생시켜야 함",
        command: { userId, newName: "admin" },
      },
    ])("$description", async ({ command }) => {
      mockUserRepository.findById.mockResolvedValue(existingUser);

      await expect(updateUserNameUseCase.execute(command)).rejects.toThrow(
        InvalidUserNameError
      );
    });

    it("사용자를 찾지 못했을 때 UserNotFoundError를 발생시켜야 함", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(updateUserNameUseCase.execute(validCommand)).rejects.toThrow(
        UserNotFoundError
      );
    });

    it("리포지토리 findById 오류를 처리해야 함", async () => {
      const error = new Error("Database connection failed");
      mockUserRepository.findById.mockRejectedValue(error);

      await expect(updateUserNameUseCase.execute(validCommand)).rejects.toThrow(
        error
      );
    });

    it("리포지토리 update 오류를 처리해야 함", async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);
      const error = new Error("Database update failed");
      mockUserRepository.update.mockRejectedValue(error);

      await expect(updateUserNameUseCase.execute(validCommand)).rejects.toThrow(
        error
      );
    });

    it("빈 문자열 이름을 처리해야 함", async () => {
      const emptyNameCommand: UpdateUserNameCommand = {
        userId,
        newName: "",
      };

      mockUserRepository.findById.mockResolvedValue(existingUser);

      await expect(
        updateUserNameUseCase.execute(emptyNameCommand)
      ).rejects.toThrow(InvalidUserNameError);
    });

    it("공백만 있는 이름을 처리해야 함", async () => {
      const whitespaceNameCommand: UpdateUserNameCommand = {
        userId,
        newName: "   ",
      };

      mockUserRepository.findById.mockResolvedValue(existingUser);

      await expect(
        updateUserNameUseCase.execute(whitespaceNameCommand)
      ).rejects.toThrow(InvalidUserNameError);
    });

    it("이름 변경 시 사용자 타임스탬프를 업데이트해야 함", async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);

      const originalUpdatedAt = existingUser.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      const updatedUser = User.fromPersistence({
        ...existingUser.toPersistence(),
        name: newName,
        updatedAt: new Date(),
      });
      mockUserRepository.update.mockResolvedValue(updatedUser);

      await updateUserNameUseCase.execute(validCommand);

      expect(existingUser.name).toBe(newName);
      expect(existingUser.updatedAt).not.toEqual(originalUpdatedAt);

      jest.useRealTimers();
    });
  });
});
