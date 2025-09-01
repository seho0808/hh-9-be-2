import { DataPlatformMessaging } from "./data-platform.messaging";
import { OrderPlacedEvent } from "./events";
import type { LoggerService } from "@nestjs/common";

jest.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

describe("DataPlatformMessaging", () => {
  let service: DataPlatformMessaging;
  let fetchMock: jest.Mock;
  let logger: LoggerService & {
    log: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
    verbose: jest.Mock;
  };
  let sleepMock: jest.Mock;
  let originalFetch: any;

  const buildEvent = () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const order: any = {
      id: "order-1",
      userId: "user-1",
      totalPrice: 1000,
      discountPrice: 100,
      finalPrice: 900,
      createdAt: now,
      orderItems: [
        { productId: "p1", quantity: 2, unitPrice: 300, totalPrice: 600 },
        { productId: "p2", quantity: 1, unitPrice: 400, totalPrice: 400 },
      ],
    };
    return new OrderPlacedEvent(order);
  };

  beforeEach(() => {
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as unknown as LoggerService & any;
    originalFetch = (global as any).fetch;
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    sleepMock = jest.fn().mockResolvedValue(undefined);
    service = new DataPlatformMessaging({
      endpoint: "http://example/mock/orders",
      timeoutMs: 50,
      logger,
      sleep: sleepMock,
    });
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test("완전한 페이로드로 1회 전송", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await service.publishOrderPlaced(buildEvent());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("http://example/mock/orders");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      eventId: "test-uuid-123",
      orderId: "order-1",
      userId: "user-1",
      totalPrice: 1000,
      discountPrice: 100,
      finalPrice: 900,
      idempotencyKey: "order-1",
      items: [
        { productId: "p1", quantity: 2, unitPrice: 300, totalPrice: 600 },
        { productId: "p2", quantity: 1, unitPrice: 400, totalPrice: 400 },
      ],
    });
    expect(body.createdAt).toBe("2025-01-01T00:00:00.000Z");
  });

  test("HTTP 500 실패 후 재시도하여 두 번째에 성공(backoff 확인)", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "e1" })
      .mockResolvedValueOnce({ ok: true });

    await service.publishOrderPlaced(buildEvent());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 1000);
  });

  test("반복 HTTP 500 시 3회 시도 후 종료(backoff 1000, 2000)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "e",
    });

    await service.publishOrderPlaced(buildEvent());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 1000);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 2000);
  });

  test("네트워크 예외 발생 시 재시도 후 종료", async () => {
    fetchMock.mockRejectedValue(new Error("network boom"));

    await service.publishOrderPlaced(buildEvent());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });

  test("성공/실패 로깅 메시지", async () => {
    // 성공 로그
    fetchMock.mockResolvedValueOnce({ ok: true });
    await service.publishOrderPlaced(buildEvent());
    expect(logger.log).toHaveBeenCalled();

    // 실패 로그 (재시도 포함)
    logger.log.mockClear();
    logger.warn.mockClear();
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "e" })
      .mockResolvedValueOnce({ ok: true });
    await service.publishOrderPlaced(buildEvent());

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const msg = logger.warn.mock.calls[0][0];
    expect(String(msg)).toContain("attempt 1/3");
    expect(String(msg)).toContain("Retrying in 1000ms");
  });
});
