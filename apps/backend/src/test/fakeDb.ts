/// <reference types="bun-types" />
import { mock, type Mock } from "bun:test";

type AnyFn = (...args: unknown[]) => Promise<unknown>;
type FakeModel = Record<string, Mock<AnyFn>>;

const stubs = new Map<string, Mock<AnyFn>>();

// Reads return an empty result by default so a handler that only cares about one lookup
// does not have to stub the rest; everything else resolves to undefined.
const defaultFor = (method: string): AnyFn =>
  (method.startsWith("findMany") ? async () => [] : async () => undefined) as AnyFn;

const stubFor = (model: string, method: string): Mock<AnyFn> => {
  const key = `${model}.${method}`;
  let stub = stubs.get(key);
  if (!stub) {
    stub = mock(defaultFor(method));
    stubs.set(key, stub);
  }
  return stub;
};

/**
 * Stand-in for the Prisma client: `fakeDb.follows.findUnique` is a mock created on first use.
 * It proves what a handler asks for and what it does with the answer. It cannot prove that
 * Prisma or MongoDB accept the query, which is checked separately against a real database.
 */
export const fakeDb = new Proxy({} as Record<string, FakeModel>, {
  get: (_target, model: string) =>
    new Proxy({} as FakeModel, {
      get: (_inner, method: string) => stubFor(model, method),
    }),
});

export const resetFakeDb = () => {
  for (const [key, stub] of stubs) {
    stub.mockReset();
    stub.mockImplementation(defaultFor(key.split(".")[1] ?? ""));
  }
};
