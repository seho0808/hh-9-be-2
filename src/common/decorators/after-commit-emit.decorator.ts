import { EventEmitter2 } from "@nestjs/event-emitter";

export function EmitOnSuccess<T extends (...args: any[]) => any>(
  eventName: string,
  buildPayload: (result: Awaited<ReturnType<T>>, args: Parameters<T>) => any
): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: any[]) => any;
    const wrapped = async function (
      this: { eventEmitter?: EventEmitter2 },
      ...args: Parameters<T>
    ): Promise<Awaited<ReturnType<T>>> {
      const result = (await original.apply(this, args)) as Awaited<
        ReturnType<T>
      >;

      const emitter = this.eventEmitter;
      if (emitter) {
        try {
          await emitter.emitAsync(eventName, buildPayload(result, args));
        } catch {
          // swallow to avoid affecting caller flow
        }
      }

      return result;
    } as any;
    (descriptor as any).value = wrapped as any;
    return descriptor;
  };
}
