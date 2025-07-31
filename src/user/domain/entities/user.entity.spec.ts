import { User } from "./user.entity";

describe("User Entity", () => {
  describe("create", () => {
    it("생성된 ID와 타임스탬프로 새 사용자를 생성해야 함", () => {
      const userData = {
        email: "test@example.com",
        password: "hashedPassword",
        name: "Test User",
      };

      const user = User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.password).toBe(userData.password);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("updateName", () => {
    it("이름과 업데이트 타임스탬프를 업데이트해야 함", () => {
      const user = User.create({
        email: "test@example.com",
        password: "hashedPassword",
        name: "Old Name",
      });

      const originalUpdatedAt = user.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      user.updateName("New Name");

      expect(user.name).toBe("New Name");
      expect(user.updatedAt).not.toBe(originalUpdatedAt);

      jest.useRealTimers();
    });
  });

  describe("updatePassword", () => {
    it("비밀번호와 업데이트 타임스탬프를 업데이트해야 함", () => {
      const user = User.create({
        email: "test@example.com",
        password: "oldPassword",
        name: "Test User",
      });

      const originalUpdatedAt = user.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      user.updatePassword("newHashedPassword");

      expect(user.password).toBe("newHashedPassword");
      expect(user.updatedAt).not.toBe(originalUpdatedAt);

      jest.useRealTimers();
    });
  });

  describe("isValidEmail", () => {
    test.each([
      "test@example.com",
      "user.name@domain.co.kr",
      "user+tag@example.org",
    ])("유효한 이메일 '%s'에 대해 true를 반환해야 함", (email) => {
      expect(User.isValidEmail(email)).toBe(true);
    });

    test.each(["invalid-email", "@example.com", "user@", "user@.com", "", " "])(
      "유효하지 않은 이메일 '%s'에 대해 false를 반환해야 함",
      (email) => {
        expect(User.isValidEmail(email)).toBe(false);
      }
    );
  });

  describe("isValidUserName", () => {
    test.each(["John Doe", "Alice", "김철수", "user123", "valid name"])(
      "유효한 사용자 이름 '%s'에 대해 true를 반환해야 함",
      (name) => {
        expect(User.isValidUserName(name)).toBe(true);
      }
    );

    test.each([
      ["", "빈 문자열"],
      ["  ", "공백 문자 2개"],
      ["a", "1자 이름"],
    ])("2자 미만의 이름 '%s'(%s)에 대해 false를 반환해야 함", (name) => {
      expect(User.isValidUserName(name)).toBe(false);
    });

    test.each([
      "admin",
      "Admin",
      "ADMIN",
      "root",
      "system",
      "admin123",
      "system_user",
    ])("금지된 단어가 포함된 이름 '%s'에 대해 false를 반환해야 함", (name) => {
      expect(User.isValidUserName(name)).toBe(false);
    });

    test.each([null, undefined])(
      "%s 이름에 대해 false를 반환해야 함",
      (name) => {
        expect(User.isValidUserName(name as any)).toBe(false);
      }
    );
  });
});
